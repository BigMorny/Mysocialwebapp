import express from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { ok } from "../lib/http";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const items = await prisma.notification.findMany({
    where: { shopId: req.user!.shopId },
    orderBy: { createdAt: "desc" },
  });
  return ok(res, items);
});

router.get("/unread-count", requireAuth, async (req, res) => {
  const unread = await prisma.notification.count({ where: { shopId: req.user!.shopId, readAt: null } });
  return ok(res, { unread });
});

router.patch("/:id/read", requireAuth, async (req, res) => {
  const updated = await prisma.notification.updateMany({
    where: { id: req.params.id, shopId: req.user!.shopId, readAt: null },
    data: { readAt: new Date() },
  });
  if (updated.count === 0) return res.status(404).json({ ok: false, error: "Notification not found." });
  return ok(res, { read: true });
});

export default router;

