import express from "express";
import { z } from "zod";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { ok } from "../lib/http";
import { isAdminVerified, setAdminVerified } from "../lib/adminVerification";
import { normalizeTarget, sha256Hex } from "../lib/crypto";

const router = express.Router();

function isAdminIdentity(user: { email?: string | null; phone?: string | null }) {
  const adminPhone = process.env.ADMIN_PHONE?.trim() ?? "";
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const userPhone = user.phone?.trim() ?? "";
  const userEmail = user.email?.trim().toLowerCase() ?? "";
  return Boolean(adminPhone && adminEmail && userPhone === adminPhone && userEmail === adminEmail);
}

function isStrongAdminPassword(password: string) {
  return (
    password.length >= 12 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.user || !isAdminIdentity(req.user) || !req.user.isAdmin) {
    return res.status(403).json({ ok: false, error: "Admin only." });
  }
  return next();
}

function requireAdminPasswordVerified(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.session?.id) return res.status(401).json({ ok: false, error: "Authentication required." });
  if (!isAdminVerified(req.session.id)) {
    return res.status(403).json({ ok: false, error: "Admin verification required" });
  }
  return next();
}

async function writeAudit(
  adminUserId: string,
  action: string,
  targetType: "SHOP" | "PAYMENT_REQUEST" | "SUPPORT",
  targetId: string,
  metaJson?: Record<string, unknown>,
) {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId,
      action,
      targetType,
      targetId,
      metaJson: (metaJson ?? {}) as Prisma.InputJsonValue,
    },
  });
}

function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function smtpTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER || "mysocialhelp00@gmail.com",
      pass: process.env.SMTP_PASS,
    },
  });
}

router.get("/verification-status", requireAuth, requireAdmin, async (req, res) => {
  return ok(res, { verified: Boolean(req.session?.id && isAdminVerified(req.session.id)) });
});

router.post("/verify-password", requireAuth, requireAdmin, async (req, res) => {
  const parsed = z.object({ password: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid body." });

  const envPassword = process.env.ADMIN_PASSWORD?.trim() ?? "";
  if (!isStrongAdminPassword(envPassword)) {
    return res.status(500).json({ ok: false, error: "Admin password is not configured securely." });
  }
  if (!req.session?.id) return res.status(401).json({ ok: false, error: "Authentication required." });
  if (parsed.data.password !== envPassword) return res.status(403).json({ ok: false, error: "Invalid admin password" });

  setAdminVerified(req.session.id);
  return ok(res, { verified: true });
});

router.get("/stats", requireAuth, requireAdmin, requireAdminPasswordVerified, async (_req, res) => {
  const [pendingApprovals, expiredShops] = await Promise.all([
    prisma.subscriptionPaymentRequest.count({ where: { status: "PENDING" } }),
    prisma.subscription.count({ where: { status: "EXPIRED" } }),
  ]);
  return ok(res, { pendingApprovals, expiredShops });
});

router.get("/payment-requests", requireAuth, requireAdmin, requireAdminPasswordVerified, async (req, res) => {
  const parsed = z.object({ status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional() }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid query." });

  const requests = await prisma.subscriptionPaymentRequest.findMany({
    where: { status: parsed.data.status ?? "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { shop: { include: { users: { orderBy: { createdAt: "asc" }, take: 1 } } } },
  });

  const normalized = requests.map((r) => {
    const owner = r.shop.users[0];
    return {
      ...r,
      owner: owner ? { name: owner.name, phone: owner.phone, email: owner.email } : null,
    };
  });

  return ok(res, normalized);
});

router.post("/payment-requests/:id/approve", requireAuth, requireAdmin, requireAdminPasswordVerified, async (req, res) => {
  const request = await prisma.subscriptionPaymentRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ ok: false, error: "Request not found." });
  if (request.status !== "PENDING") return res.status(409).json({ ok: false, error: "Request already decided." });

  const now = new Date();
  const endsAt = new Date(now.getTime() + (request.billingCycle === "MONTHLY" ? 30 : 365) * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.subscriptionPaymentRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", decidedAt: now, decidedByUserId: req.user!.id },
    }),
    prisma.subscription.create({
      data: {
        shopId: request.shopId,
        status: "ACTIVE",
        trialEndsAt: null,
        billingCycle: request.billingCycle,
        amountGhs: request.amountGhs,
        startedAt: now,
        endsAt,
      },
    }),
    prisma.adminAuditLog.create({
      data: {
        adminUserId: req.user!.id,
        action: "PAYMENT_APPROVED",
        targetType: "PAYMENT_REQUEST",
        targetId: request.id,
        metaJson: { shopId: request.shopId, billingCycle: request.billingCycle, amountGhs: request.amountGhs },
      },
    }),
  ]);

  return ok(res, { approved: true });
});

router.post("/payment-requests/:id/reject", requireAuth, requireAdmin, requireAdminPasswordVerified, async (req, res) => {
  const parsed = z.object({ note: z.string().max(500).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid body." });

  const request = await prisma.subscriptionPaymentRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ ok: false, error: "Request not found." });
  if (request.status !== "PENDING") return res.status(409).json({ ok: false, error: "Request already decided." });

  await prisma.$transaction([
    prisma.subscriptionPaymentRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        note: parsed.data.note ?? null,
        decidedAt: new Date(),
        decidedByUserId: req.user!.id,
      },
    }),
    prisma.adminAuditLog.create({
      data: {
        adminUserId: req.user!.id,
        action: "PAYMENT_REJECTED",
        targetType: "PAYMENT_REQUEST",
        targetId: request.id,
        metaJson: { shopId: request.shopId, note: parsed.data.note ?? null },
      },
    }),
  ]);
  return ok(res, { rejected: true });
});

router.get("/shops", requireAuth, requireAdmin, requireAdminPasswordVerified, async (_req, res) => {
  const shops = await prisma.shop.findMany({
    where: {
      users: { none: { isAdmin: true } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      users: { orderBy: { createdAt: "asc" }, take: 1 },
      subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
      paymentRequests: { where: { status: "PENDING" }, select: { id: true } },
    },
  });

  const data = shops.map((shop) => {
    const owner = shop.users[0] ?? null;
    const sub = shop.subscriptions[0] ?? null;
    const status = sub?.status === "EXPIRED" ? "VIEW_ONLY" : sub?.status ?? "VIEW_ONLY";
    return {
      id: shop.id,
      name: shop.name,
      ownerName: owner?.name ?? null,
      phone: owner?.phone ?? shop.phone,
      email: owner?.email ?? shop.email,
      subscriptionStatus: status,
      trialEndsAt: sub?.trialEndsAt ?? null,
      endsAt: sub?.endsAt ?? null,
      createdAt: shop.createdAt,
      pendingApprovals: shop.paymentRequests.length,
    };
  });

  return ok(res, data);
});

router.post("/shops/:shopId/activate", requireAuth, requireAdmin, requireAdminPasswordVerified, async (req, res) => {
  const parsed = z.object({
    cycle: z.enum(["MONTHLY", "ANNUAL"]),
    amountGhs: z.number().int().positive().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid body." });

  const shop = await prisma.shop.findUnique({ where: { id: req.params.shopId } });
  if (!shop) return res.status(404).json({ ok: false, error: "Shop not found." });

  const now = new Date();
  const durationDays = parsed.data.cycle === "ANNUAL" ? 365 : 30;
  const endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  await prisma.$transaction([
    prisma.subscription.create({
      data: {
        shopId: shop.id,
        status: "ACTIVE",
        trialEndsAt: null,
        billingCycle: parsed.data.cycle,
        amountGhs: parsed.data.amountGhs ?? (parsed.data.cycle === "MONTHLY" ? 59 : 590),
        startedAt: now,
        endsAt,
      },
    }),
    prisma.adminAuditLog.create({
      data: {
        adminUserId: req.user!.id,
        action: "SHOP_ACTIVATED",
        targetType: "SHOP",
        targetId: shop.id,
        metaJson: { days: durationDays, cycle: parsed.data.cycle, amountGhs: parsed.data.amountGhs ?? null },
      },
    }),
  ]);

  return ok(res, { activated: true });
});

router.post("/shops/:shopId/extend-trial", requireAuth, requireAdmin, requireAdminPasswordVerified, async (req, res) => {
  const parsed = z.object({ days: z.number().int().positive().max(3650) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid body." });

  const latest = await prisma.subscription.findFirst({
    where: { shopId: req.params.shopId },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return res.status(404).json({ ok: false, error: "Subscription not found for shop." });

  const base = latest.trialEndsAt && latest.trialEndsAt.getTime() > Date.now() ? latest.trialEndsAt : new Date();
  const trialEndsAt = new Date(base.getTime() + parsed.data.days * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: latest.id },
      data: { status: "TRIALING", trialEndsAt },
    }),
    prisma.adminAuditLog.create({
      data: {
        adminUserId: req.user!.id,
        action: "SHOP_TRIAL_EXTENDED",
        targetType: "SHOP",
        targetId: req.params.shopId,
        metaJson: { days: parsed.data.days, trialEndsAt: trialEndsAt.toISOString() },
      },
    }),
  ]);

  return ok(res, { extended: true, trialEndsAt });
});

router.post("/shops/:shopId/suspend", requireAuth, requireAdmin, requireAdminPasswordVerified, async (req, res) => {
  const parsed = z.object({ reason: z.string().max(500).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid body." });

  const latest = await prisma.subscription.findFirst({
    where: { shopId: req.params.shopId },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return res.status(404).json({ ok: false, error: "Subscription not found for shop." });

  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: latest.id },
      data: { status: "EXPIRED", endsAt: new Date() },
    }),
    prisma.adminAuditLog.create({
      data: {
        adminUserId: req.user!.id,
        action: "SHOP_SUSPENDED",
        targetType: "SHOP",
        targetId: req.params.shopId,
        metaJson: { reason: parsed.data.reason ?? null },
      },
    }),
  ]);

  return ok(res, { suspended: true });
});

router.delete("/shops/:shopId", requireAuth, requireAdmin, requireAdminPasswordVerified, async (req, res) => {
  const shop = await prisma.shop.findUnique({
    where: { id: req.params.shopId },
    include: { users: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  if (!shop) return res.status(404).json({ ok: false, error: "Shop not found." });

  const owner = shop.users[0] ?? null;
  const userRows = await prisma.user.findMany({
    where: { shopId: shop.id },
    select: { id: true },
  });
  const userIds = userRows.map((u) => u.id);

  const inventoryRows = await prisma.inventoryItem.findMany({
    where: { shopId: shop.id },
    select: { id: true },
  });
  const inventoryIds = inventoryRows.map((i) => i.id);

  const dealerRows = await prisma.dealer.findMany({
    where: { shopId: shop.id },
    select: { id: true },
  });
  const dealerIds = dealerRows.map((d) => d.id);

  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { shopId: shop.id } }),
    prisma.consignment.deleteMany({ where: { shopId: shop.id } }),
    prisma.assignment.deleteMany({
      where: {
        OR: [
          inventoryIds.length ? { itemId: { in: inventoryIds } } : undefined,
          dealerIds.length ? { dealerId: { in: dealerIds } } : undefined,
          userIds.length ? { assignedByUserId: { in: userIds } } : undefined,
        ].filter(Boolean) as any[],
      },
    }),
    prisma.sale.deleteMany({
      where: {
        OR: [
          inventoryIds.length ? { itemId: { in: inventoryIds } } : undefined,
          dealerIds.length ? { dealerId: { in: dealerIds } } : undefined,
          userIds.length ? { recordedByUserId: { in: userIds } } : undefined,
        ].filter(Boolean) as any[],
      },
    }),
    prisma.inventoryItem.deleteMany({ where: { shopId: shop.id } }),
    prisma.dealer.deleteMany({ where: { shopId: shop.id } }),
    prisma.subscriptionPaymentRequest.deleteMany({ where: { shopId: shop.id } }),
    prisma.subscription.deleteMany({ where: { shopId: shop.id } }),
    prisma.passwordResetToken.deleteMany({ where: userIds.length ? { userId: { in: userIds } } : { id: "__none__" } }),
    prisma.session.deleteMany({ where: userIds.length ? { userId: { in: userIds } } : { id: "__none__" } }),
    prisma.authorizedDevice.deleteMany({ where: userIds.length ? { userId: { in: userIds } } : { id: "__none__" } }),
    prisma.adminAuditLog.deleteMany({ where: userIds.length ? { adminUserId: { in: userIds } } : { id: "__none__" } }),
    prisma.user.deleteMany({ where: { shopId: shop.id } }),
    prisma.shop.delete({ where: { id: shop.id } }),
    prisma.adminAuditLog.create({
      data: {
        adminUserId: req.user!.id,
        action: "DELETE_SHOP",
        targetType: "SHOP",
        targetId: shop.id,
        metaJson: {
          shopName: shop.name,
          ownerEmail: owner?.email ?? null,
          ownerPhone: owner?.phone ?? null,
        },
      },
    }),
  ]);

  return res.json({ ok: true });
});

router.get("/audit", requireAuth, requireAdmin, requireAdminPasswordVerified, async (req, res) => {
  const parsed = z.object({ limit: z.coerce.number().int().min(1).max(500).optional() }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid query." });
  const limit = parsed.data.limit ?? 100;

  const rows = await prisma.adminAuditLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { adminUser: { select: { id: true, name: true, email: true, phone: true } } },
  });
  return ok(res, rows);
});

router.post("/support/send-password-reset", requireAuth, requireAdmin, requireAdminPasswordVerified, async (req, res) => {
  const parsed = z.object({ target: z.string().min(3) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid body." });

  const targetRaw = normalizeTarget(parsed.data.target);
  const targetIsEmail = targetRaw.includes("@");
  let user = null as Awaited<ReturnType<typeof prisma.user.findFirst>> | null;

  if (targetIsEmail) {
    user = await prisma.user.findUnique({ where: { email: targetRaw } });
  } else {
    user = await prisma.user.findUnique({ where: { phone: targetRaw } });
    if (user?.email) {
      user = await prisma.user.findUnique({ where: { email: user.email } });
    }
  }

  if (user?.email) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt, used: false },
    });

    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const resetLink = `${appBaseUrl}/reset-password?token=${rawToken}`;
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log(`Admin reset link for ${user.email}: ${resetLink}`);
    }

    if (isSmtpConfigured()) {
      try {
        await smtpTransport().sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER || "mysocialhelp00@gmail.com",
          to: user.email,
          subject: "MySocial password reset",
          text: `Reset your password using this link: ${resetLink}`,
          html: `<p>Reset your password using this link:</p><p><a href="${resetLink}">${resetLink}</a></p>`,
        });
      } catch {
        // do not leak
      }
    }
  }

  await writeAudit(req.user!.id, "SUPPORT_PASSWORD_RESET_TRIGGERED", "SUPPORT", targetRaw, { target: targetRaw });
  return ok(res, { sent: true });
});

router.post("/utils/normalize-trials-to-7-days", requireAuth, requireAdmin, requireAdminPasswordVerified, async (req, res) => {
  const parsed = z.object({ confirm: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid body." });
  if (parsed.data.confirm !== "NORMALIZE_TRIALS_TO_7_DAYS") {
    return res.status(400).json({ ok: false, error: "Confirmation text mismatch." });
  }

  const now = new Date();
  const cap = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const trialing = await prisma.subscription.findMany({
    where: { status: "TRIALING" },
    select: { id: true, shopId: true, trialEndsAt: true, createdAt: true },
  });

  const byShop = new Map<string, { id: string; trialEndsAt: Date | null; createdAt: Date }>();
  for (const sub of trialing) {
    const prev = byShop.get(sub.shopId);
    if (!prev || sub.createdAt.getTime() > prev.createdAt.getTime()) {
      byShop.set(sub.shopId, { id: sub.id, trialEndsAt: sub.trialEndsAt, createdAt: sub.createdAt });
    }
  }

  let updated = 0;
  for (const row of byShop.values()) {
    const shouldCap = !row.trialEndsAt || row.trialEndsAt.getTime() > cap.getTime();
    if (!shouldCap) continue;
    await prisma.subscription.update({
      where: { id: row.id },
      data: { trialEndsAt: cap },
    });
    updated += 1;
  }

  await writeAudit(req.user!.id, "UTIL_NORMALIZE_TRIALS_TO_7_DAYS", "SUPPORT", "TRIALING_SUBSCRIPTIONS", {
    processed: byShop.size,
    updated,
    capIso: cap.toISOString(),
  });

  return ok(res, {
    processed: byShop.size,
    updated,
    cappedTo: cap.toISOString(),
  });
});

export default router;
