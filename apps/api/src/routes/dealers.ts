import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ok } from "../lib/http";
import { requireAuth } from "../middleware/auth";

const router = express.Router();

const CreateDealerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(3),
  locationNote: z.string().max(300).optional().nullable(),
  idType: z.string().max(100).optional().nullable(),
  idNumber: z.string().max(120).optional().nullable(),
});

const UpdateDealerSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(3).optional(),
  locationNote: z.string().max(300).optional().nullable(),
  idType: z.string().max(100).optional().nullable(),
  idNumber: z.string().max(120).optional().nullable(),
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = CreateDealerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "Invalid body." });
  }

  const dealer = await prisma.dealer.create({
    data: {
      createdByUserId: req.user!.id,
      shopId: req.user!.shopId,
      name: parsed.data.name,
      phone: parsed.data.phone,
      locationNote: parsed.data.locationNote ?? null,
      idType: parsed.data.idType ?? null,
      idNumber: parsed.data.idNumber ?? null,
    },
  });
  return ok(res, dealer, 201);
});

router.get("/", requireAuth, async (req, res) => {
  const dealers = await prisma.dealer.findMany({
    where: { shopId: req.user!.shopId },
    orderBy: { createdAt: "desc" },
  });
  return ok(res, dealers);
});

router.get("/:id", requireAuth, async (req, res) => {
  const dealer = await prisma.dealer.findFirst({
    where: { id: req.params.id, shopId: req.user!.shopId },
  });
  if (!dealer) return res.status(404).json({ ok: false, error: "Dealer not found." });
  return ok(res, dealer);
});

router.get("/:id/consignments", requireAuth, async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status.toUpperCase() : "ALL";
  const dealer = await prisma.dealer.findFirst({
    where: { id: req.params.id, shopId: req.user!.shopId },
    select: { id: true },
  });
  if (!dealer) return res.status(404).json({ ok: false, error: "Dealer not found." });

  const consignments = await prisma.consignment.findMany({
    where: {
      shopId: req.user!.shopId,
      dealerId: dealer.id,
      ...(status === "ACTIVE" ? { status: "OUT_WITH_DEALER" } : {}),
    },
    include: { inventoryItem: true, dealer: true },
    orderBy: { createdAt: "desc" },
  });
  return ok(res, consignments);
});

router.put("/:id", requireAuth, async (req, res) => {
  const parsed = UpdateDealerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid body." });

  const dealer = await prisma.dealer.findFirst({
    where: { id: req.params.id, shopId: req.user!.shopId },
    select: { id: true },
  });
  if (!dealer) return res.status(404).json({ ok: false, error: "Dealer not found." });

  const updated = await prisma.dealer.update({
    where: { id: dealer.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      locationNote: parsed.data.locationNote,
      idType: parsed.data.idType,
      idNumber: parsed.data.idNumber,
    },
  });

  return ok(res, updated);
});

router.delete("/:id", requireAuth, async (req, res) => {
  const dealer = await prisma.dealer.findFirst({
    where: { id: req.params.id, shopId: req.user!.shopId },
    select: { id: true },
  });
  if (!dealer) return res.status(404).json({ ok: false, error: "Dealer not found." });

  const activeCount = await prisma.consignment.count({
    where: { dealerId: dealer.id, shopId: req.user!.shopId, status: "OUT_WITH_DEALER" },
  });
  if (activeCount > 0) {
    return res.status(409).json({ ok: false, error: "Dealer has active consignments." });
  }

  await prisma.dealer.delete({ where: { id: dealer.id } });
  return res.json({ ok: true, data: { deleted: true } });
});

export default router;


