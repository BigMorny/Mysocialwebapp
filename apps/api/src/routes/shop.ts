import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { ok } from "../lib/http";

const router = express.Router();

const UpdateShopSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(3),
  ownerName: z.string().min(1).optional(),
  locationNote: z.string().max(500).optional().nullable(),
  email: z.string().email().optional(),
});

router.get("/me", requireAuth, async (req, res) => {
  const shop = await prisma.shop.findUnique({ where: { id: req.user!.shopId } });
  if (!shop) return res.status(404).json({ ok: false, error: "Shop not found." });
  return ok(res, {
    ...shop,
    ownerName: req.user!.name,
  });
});

router.patch("/me", requireAuth, async (req, res) => {
  const parsed = UpdateShopSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid body." });

  const updated = await prisma.shop.update({
    where: { id: req.user!.shopId },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      locationNote: parsed.data.locationNote ?? null,
      ...(parsed.data.email ? { email: parsed.data.email } : {}),
    },
  });

  if (parsed.data.ownerName) {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { name: parsed.data.ownerName },
    });
  }

  return ok(res, {
    ...updated,
    ownerName: parsed.data.ownerName ?? req.user!.name,
  });
});

export default router;
