import express from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { isViewOnly } from "../middleware/subscription";
import { ok } from "../lib/http";

const router = express.Router();

router.get("/summary", requireAuth, async (req, res) => {
  const shopId = req.user!.shopId;
  const [shop, subscription, inventory, dealers, consignments, overdueConsignments, unreadNotifications] = await Promise.all([
    prisma.shop.findUnique({ where: { id: shopId } }),
    prisma.subscription.findFirst({ where: { shopId }, orderBy: { createdAt: "desc" } }),
    prisma.inventoryItem.count({ where: { shopId } }),
    prisma.dealer.count({ where: { shopId } }),
    prisma.consignment.count({ where: { shopId } }),
    prisma.consignment.count({
      where: {
        shopId,
        status: "OUT_WITH_DEALER",
        expectedReturnAt: { lt: new Date() },
      },
    }),
    prisma.notification.count({ where: { shopId, readAt: null } }),
  ]);

  return ok(res, {
    user: { id: req.user!.id, isAdmin: req.user!.isAdmin },
    shop,
    subscription: subscription ? { ...subscription, viewOnly: isViewOnly(subscription) } : null,
    counts: { inventory, dealers, consignments, overdueConsignments },
    unreadNotifications,
  });
});

export default router;
