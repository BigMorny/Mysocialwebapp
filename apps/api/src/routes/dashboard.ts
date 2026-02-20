import express from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { isViewOnly } from "../middleware/subscription";
import { ok } from "../lib/http";

const router = express.Router();

router.get("/summary", requireAuth, async (req, res) => {
  const shopId = req.user!.shopId;
  const now = new Date();
  const [shop, subscription, totalInventory, inShop, withDealer, sold, dealers, overdueRows, unreadNotifications] = await Promise.all([
    prisma.shop.findUnique({ where: { id: shopId } }),
    prisma.subscription.findFirst({ where: { shopId }, orderBy: { createdAt: "desc" } }),
    prisma.inventoryItem.count({ where: { shopId, status: { not: "SOLD" } } }),
    prisma.inventoryItem.count({ where: { shopId, status: "IN_SHOP" } }),
    prisma.inventoryItem.count({ where: { shopId, status: "OUT_WITH_DEALER" } }),
    prisma.inventoryItem.count({ where: { shopId, status: "SOLD" } }),
    prisma.dealer.count({ where: { shopId } }),
    prisma.consignment.findMany({
      where: {
        shopId,
        status: "OUT_WITH_DEALER",
        expectedReturnAt: { lt: now },
        inventoryItem: {
          status: "OUT_WITH_DEALER",
        },
      },
      select: { inventoryItemId: true },
      distinct: ["inventoryItemId"],
    }),
    prisma.notification.count({ where: { shopId, readAt: null } }),
  ]);

  return ok(res, {
    user: { id: req.user!.id, isAdmin: req.user!.isAdmin },
    shop,
    subscription: subscription ? { ...subscription, viewOnly: isViewOnly(subscription) } : null,
    counts: {
      inventory: totalInventory,
      totalInventory,
      inShop,
      withDealer,
      sold,
      dealers,
      consignments: withDealer,
      overdueConsignments: overdueRows.length,
    },
    unreadNotifications,
  });
});

export default router;
