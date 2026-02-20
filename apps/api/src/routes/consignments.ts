import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { ok } from "../lib/http";

const router = express.Router();

const CreateConsignmentSchema = z.object({
  inventoryItemId: z.string().min(1),
  dealerId: z.string().min(1),
  expectedPresetHours: z.union([z.literal(6), z.literal(12), z.literal(24), z.literal(48)]).optional(),
  expectedReturnAt: z.string().datetime().optional().nullable(),
  agreedPrice: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const UpdateConsignmentStatusSchema = z.object({
  status: z.enum(["SOLD", "RETURNED", "LOST"]),
  soldPrice: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = CreateConsignmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid body." });

  const userId = req.user!.id;
  const shopId = req.user!.shopId;
  const { inventoryItemId, dealerId, agreedPrice, notes, expectedReturnAt, expectedPresetHours } = parsed.data;

  const [item, dealer] = await Promise.all([
    prisma.inventoryItem.findFirst({ where: { id: inventoryItemId, shopId } }),
    prisma.dealer.findFirst({ where: { id: dealerId, shopId } }),
  ]);
  if (!item) return res.status(404).json({ ok: false, error: "Inventory item not found." });
  if (!dealer) return res.status(404).json({ ok: false, error: "Dealer not found." });
  const existingActive = await prisma.consignment.findFirst({
    where: {
      shopId,
      inventoryItemId,
      status: "OUT_WITH_DEALER",
    },
    select: { id: true },
  });
  if (existingActive) {
    return res.status(400).json({ ok: false, error: "Item already out with a dealer" });
  }
  if (item.status === "SOLD" || item.status === "OUT_WITH_DEALER") {
    return res.status(409).json({ ok: false, error: "Item cannot be consigned in current status." });
  }
  const handedOutAt = new Date();
  const computedExpectedReturnAt =
    expectedPresetHours !== undefined
      ? new Date(handedOutAt.getTime() + expectedPresetHours * 60 * 60 * 1000)
      : expectedReturnAt
        ? new Date(expectedReturnAt)
        : null;
  if (computedExpectedReturnAt && computedExpectedReturnAt.getTime() <= handedOutAt.getTime()) {
    return res.status(400).json({ ok: false, error: "expectedReturnAt must be in the future." });
  }

  const created = await prisma.$transaction(async (tx) => {
    const consignment = await tx.consignment.create({
      data: {
        createdByUserId: userId,
        shopId,
        inventoryItemId,
        dealerId,
        status: "OUT_WITH_DEALER",
        handedOutAt,
        expectedReturnAt: computedExpectedReturnAt,
        agreedPrice: agreedPrice ?? null,
        notes: notes ?? null,
      },
    });
    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { status: "OUT_WITH_DEALER" },
    });
    return consignment;
  });

  return ok(res, created, 201);
});

router.get("/", requireAuth, async (req, res) => {
  const querySchema = z.object({
    status: z.enum(["OUT_WITH_DEALER", "SOLD", "RETURNED", "LOST"]).optional(),
    dealerId: z.string().optional(),
    inventoryItemId: z.string().optional(),
  });
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid query." });

  const where = {
    shopId: req.user!.shopId,
    status: parsed.data.status,
    dealerId: parsed.data.dealerId,
    inventoryItemId: parsed.data.inventoryItemId,
  };

  const consignments = await prisma.consignment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      dealer: true,
      inventoryItem: true,
    },
  });

  const overdue = consignments.filter(
    (c) => c.status === "OUT_WITH_DEALER" && c.expectedReturnAt && Date.now() > c.expectedReturnAt.getTime(),
  );
  if (overdue.length > 0) {
    await Promise.all(
      overdue.map((c) =>
        prisma.notification.upsert({
          where: { type_consignmentId: { type: "CONSIGNMENT_OVERDUE", consignmentId: c.id } },
          update: {},
          create: {
            shopId: req.user!.shopId,
            type: "CONSIGNMENT_OVERDUE",
            consignmentId: c.id,
            message: `Consignment ${c.id} is overdue.`,
          },
        }),
      ),
    );
  }
  return ok(res, consignments);
});

router.patch("/:id/status", requireAuth, async (req, res) => {
  const parsed = UpdateConsignmentStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid body." });

  const consignment = await prisma.consignment.findFirst({
    where: { id: req.params.id, shopId: req.user!.shopId },
  });
  if (!consignment) return res.status(404).json({ ok: false, error: "Consignment not found." });
  if (consignment.status !== "OUT_WITH_DEALER") {
    return res.status(409).json({ ok: false, error: "Consignment is already closed." });
  }

  const nextItemStatus = parsed.data.status === "SOLD" ? "SOLD" : "IN_SHOP";
  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.consignment.update({
      where: { id: consignment.id },
      data: {
        status: parsed.data.status,
        soldPrice: parsed.data.status === "SOLD" ? (parsed.data.soldPrice ?? null) : null,
        notes: parsed.data.notes ?? consignment.notes,
        closedAt: new Date(),
      },
    });

    await tx.inventoryItem.update({
      where: { id: consignment.inventoryItemId },
      data: {
        status: nextItemStatus,
        soldAt: parsed.data.status === "SOLD" ? new Date() : undefined,
      },
    });
    return record;
  });

  return ok(res, updated);
});

export default router;
