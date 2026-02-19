import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { ok } from "../lib/http";

const router = express.Router();

const querySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

router.get("/monthly", requireAuth, async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid query." });

  const { year, month } = parsed.data;
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const shopId = req.user!.shopId;

  const categories = ["PHONE", "LAPTOP", "GADGET"] as const;

  const categoryResults = await Promise.all(
    categories.map(async (category) => {
      const [added, sold, remaining] = await Promise.all([
        prisma.inventoryItem.count({
          where: { shopId, inventoryCategory: category, createdAt: { gte: start, lt: end } },
        }),
        prisma.inventoryItem.count({
          where: { shopId, inventoryCategory: category, soldAt: { gte: start, lt: end } },
        }),
        prisma.inventoryItem.count({
          where: { shopId, inventoryCategory: category, status: { not: "SOLD" } },
        }),
      ]);
      return { category, added, sold, remaining };
    }),
  );

  const [phones, laptops, gadgets] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { shopId, inventoryCategory: "PHONE" },
      select: { brand: true, model: true, status: true },
    }),
    prisma.inventoryItem.findMany({
      where: { shopId, inventoryCategory: "LAPTOP" },
      select: { brand: true, model: true, status: true },
    }),
    prisma.inventoryItem.findMany({
      where: { shopId, inventoryCategory: "GADGET" },
      select: { gadgetType: true, status: true },
    }),
  ]);

  const phonesByModel = Object.values(
    phones.reduce<Record<string, { brand: string; model: string; total: number; sold: number; remaining: number }>>(
      (acc, item) => {
        const key = `${item.brand || "Unknown"}::${item.model || "Unknown"}`;
        if (!acc[key]) {
          acc[key] = { brand: item.brand || "Unknown", model: item.model || "Unknown", total: 0, sold: 0, remaining: 0 };
        }
        acc[key].total += 1;
        if (item.status === "SOLD") acc[key].sold += 1;
        else acc[key].remaining += 1;
        return acc;
      },
      {},
    ),
  ).sort((a, b) => b.total - a.total);

  const laptopsByModel = Object.values(
    laptops.reduce<Record<string, { brand: string; model: string; total: number; sold: number; remaining: number }>>(
      (acc, item) => {
        const key = `${item.brand || "Unknown"}::${item.model || "Unknown"}`;
        if (!acc[key]) {
          acc[key] = { brand: item.brand || "Unknown", model: item.model || "Unknown", total: 0, sold: 0, remaining: 0 };
        }
        acc[key].total += 1;
        if (item.status === "SOLD") acc[key].sold += 1;
        else acc[key].remaining += 1;
        return acc;
      },
      {},
    ),
  ).sort((a, b) => b.total - a.total);

  const gadgetsByType = Object.values(
    gadgets.reduce<Record<string, { gadgetType: string; total: number; sold: number; remaining: number }>>((acc, item) => {
      const key = item.gadgetType || "General";
      if (!acc[key]) {
        acc[key] = { gadgetType: key, total: 0, sold: 0, remaining: 0 };
      }
      acc[key].total += 1;
      if (item.status === "SOLD") acc[key].sold += 1;
      else acc[key].remaining += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.total - a.total);

  const resultMap = categoryResults.reduce<Record<string, { added: number; sold: number; remaining: number }>>((acc, row) => {
    acc[row.category] = { added: row.added, sold: row.sold, remaining: row.remaining };
    return acc;
  }, {});

  return ok(res, {
    range: { start: start.toISOString(), end: end.toISOString() },
    categories: {
      PHONE: resultMap.PHONE ?? { added: 0, sold: 0, remaining: 0 },
      LAPTOP: resultMap.LAPTOP ?? { added: 0, sold: 0, remaining: 0 },
      GADGET: resultMap.GADGET ?? { added: 0, sold: 0, remaining: 0 },
    },
    breakdown: { phonesByModel, laptopsByModel, gadgetsByType },
  });
});

export default router;
