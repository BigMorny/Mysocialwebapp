import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";

function isSafeReadMethod(method: string) {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

function canWriteDuringViewOnly(path: string) {
  return (
    path.startsWith("/api/subscription/payment-request") ||
    path.startsWith("/api/admin/payment-requests")
  );
}

export async function subscriptionMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return next();
  if (req.user.isAdmin) return next();
  if (req.path.startsWith("/api/admin")) return next();

  const shop = await prisma.shop.findUnique({ where: { id: req.user.shopId } });
  req.shop = shop ?? undefined;

  const sub = await prisma.subscription.findFirst({
    where: { shopId: req.user.shopId },
    orderBy: { createdAt: "desc" },
  });
  req.subscription = sub;

  if (req.path.startsWith("/api/auth") || req.path.startsWith("/api/security")) return next();

  if (!sub) {
    if (isSafeReadMethod(req.method) || req.path.startsWith("/api/export")) return next();
    return res.status(402).json({ ok: false, error: "Subscription required", viewOnly: true });
  }

  const now = Date.now();
  const trialingValid =
    sub.status === "TRIALING" &&
    Boolean(sub.trialEndsAt) &&
    now <= sub.trialEndsAt!.getTime();
  const isActive = sub.status === "ACTIVE";
  const viewOnly = !(isActive || trialingValid);

  if (viewOnly && sub.status !== "EXPIRED") {
    prisma.subscription.update({ where: { id: sub.id }, data: { status: "EXPIRED" } }).catch(() => undefined);
  }

  if (!viewOnly) return next();

  if (isSafeReadMethod(req.method)) return next();
  if (req.path.startsWith("/api/export")) return next();
  if (canWriteDuringViewOnly(req.path)) return next();

  return res.status(402).json({ ok: false, error: "Subscription required", viewOnly: true });
}

export function isViewOnly(sub: Request["subscription"]) {
  if (!sub) return true;
  if (sub.status === "ACTIVE") return false;
  if (sub.status !== "TRIALING") return true;
  if (!sub.trialEndsAt) return true;
  if (Date.now() > sub.trialEndsAt.getTime()) {
    return true;
  }
  return false;
}


