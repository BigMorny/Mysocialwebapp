import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ok, fail } from "../lib/http";
import { requireAuth } from "../middleware/auth";

const router = express.Router();

const CreateAssignmentSchema = z.object({
  inventoryId: z.string().min(1),
  dealerId: z.string().min(1),
  notes: z.string().max(500).optional(),
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = CreateAssignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "VALIDATION_ERROR", "Invalid body.", parsed.error.flatten());
  }
  const { inventoryId, dealerId, notes } = parsed.data;

  const item = await prisma.inventoryItem.findFirst({ where: { id: inventoryId, shopId: req.user!.shopId } });
  if (!item) return fail(res, 404, "NOT_FOUND", "Inventory item not found.");
  if (item.status !== "IN_SHOP") return fail(res, 409, "FORBIDDEN", "Item is not available for assignment.");

  const dealer = await prisma.dealer.findFirst({ where: { id: dealerId, shopId: req.user!.shopId } });
  if (!dealer) return fail(res, 404, "NOT_FOUND", "Dealer not found.");

  const assignment = await prisma.$transaction(async (tx) => {
    const created = await tx.assignment.create({
      data: {
        itemId: inventoryId,
        dealerId,
        assignedByUserId: req.user!.id,
        status: "active",
        notes: notes ?? null,
      },
    });

    await tx.inventoryItem.update({
      where: { id: inventoryId },
      data: { status: "OUT_WITH_DEALER" },
    });

    return created;
  });

  return ok(res, {
    id: assignment.id,
    inventoryId,
    dealerId,
    assignedAt: assignment.assignedAt,
    assignedBy: assignment.assignedByUserId,
  }, 201);
});

router.get("/", requireAuth, async (req, res) => {
  const assignments = await prisma.assignment.findMany({
    where: { item: { shopId: req.user!.shopId } },
    orderBy: { assignedAt: "desc" },
    include: {
      item: true,
      dealer: true,
      assignedBy: true,
    },
  });

  const data = assignments.map((a) => ({
    id: a.id,
    inventoryId: a.itemId,
    dealerId: a.dealerId,
    assignedAt: a.assignedAt,
    assignedBy: a.assignedByUserId,
    inventory: {
      id: a.item.id,
      brand: a.item.category,
      model: a.item.name,
      imei: a.item.imei1,
      serialNumber: a.item.serial,
      condition: a.item.condition,
    },
    dealer: {
      id: a.dealer.id,
      name: a.dealer.name,
      phone: a.dealer.phone,
    },
  }));

  return ok(res, data);
});

export default router;


