import express from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { fail, ok } from "../lib/http";
import { computeFingerprintHash } from "../lib/deviceFingerprint";
import { normalizeTarget, randomTokenHex, sha256Hex } from "../lib/crypto";
import { requireAuth } from "../middleware/auth";
import { isViewOnly } from "../middleware/subscription";
import { clearAdminVerified } from "../lib/adminVerification";

const router = express.Router();

const SignupSchema = z.object({
  ownerName: z.string().min(1),
  shopName: z.string().min(1),
  phone: z.string().regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits"),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  location: z.string().max(500).optional().nullable(),
});

const LoginSchema = z.object({
  target: z.string().min(3),
  password: z.string().min(8).max(200),
});

const ForgotPasswordSchema = z.object({ email: z.string().email() });
const ResetPasswordSchema = z.object({ token: z.string().min(10), password: z.string().min(8).max(200) });

function shouldBeAdmin(user: { email: string | null; phone: string | null }) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPhone = process.env.ADMIN_PHONE?.trim();
  const userEmail = user.email?.toLowerCase() ?? null;
  const userPhone = user.phone ?? null;
  return Boolean(adminEmail && adminPhone && userEmail === adminEmail && userPhone === adminPhone);
}

const cookieOpts = {
  httpOnly: true,
  sameSite: "none" as const,
  secure: true,
  path: "/",
  maxAge: 5 * 60 * 60 * 1000,
};

const clearCookieOpts = {
  httpOnly: true,
  sameSite: "none" as const,
  secure: true,
  path: "/",
};

function sessionCookieName() {
  return process.env.SESSION_COOKIE_NAME || "mysocial_session";
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

async function createSessionAndSetCookie(req: express.Request, res: express.Response, userId: string) {
  const fingerprintHash = computeFingerprintHash(req) ?? sha256Hex(`${userId}:${Date.now()}:${Math.random()}`);
  const existingDevice = await prisma.authorizedDevice.findFirst({
    where: { userId, fingerprintHash, revokedAt: null },
  });

  let deviceId: string;
  if (existingDevice) {
    await prisma.authorizedDevice.update({
      where: { id: existingDevice.id },
      data: { lastSeenAt: new Date() },
    });
    deviceId = existingDevice.id;
  } else {
    const label = (req.headers["user-agent"] ?? "Unknown device").toString().slice(0, 120);
    const created = await prisma.authorizedDevice.create({
      data: { userId, fingerprintHash, label, lastSeenAt: new Date() },
    });
    deviceId = created.id;
  }

  const token = randomTokenHex(32);
  const tokenHash = sha256Hex(token);
  await prisma.session.create({
    data: {
      userId,
      deviceId,
      tokenHash,
      lastActivityAt: new Date(),
    },
  });

  res.cookie(sessionCookieName(), token, cookieOpts);
}

router.post("/request-otp", async (_req, res) => {
  return res.status(410).json({ ok: false, error: "OTP disabled" });
});

router.post("/verify-otp", async (_req, res) => {
  return res.status(410).json({ ok: false, error: "OTP disabled" });
});

router.post("/set-password", async (_req, res) => {
  return res.status(410).json({ ok: false, error: "OTP disabled" });
});

router.post("/signup", async (req, res) => {
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "VALIDATION_ERROR", "Invalid body.", parsed.error.flatten());

  const email = normalizeTarget(parsed.data.email);
  const phone = normalizeTarget(parsed.data.phone);
  if (!/^[0-9]{10}$/.test(phone)) {
    return res.status(400).json({ ok: false, error: "Phone number must be exactly 10 digits" });
  }

  const [existingEmail, existingPhone] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { phone } }),
  ]);
  if (existingEmail) return fail(res, 409, "FORBIDDEN", "Email already exists.");
  if (existingPhone) return fail(res, 409, "FORBIDDEN", "Phone already exists.");

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const created = await prisma.$transaction(async (tx) => {
    const shop = await tx.shop.create({
      data: {
        name: parsed.data.shopName,
        email,
        phone,
        locationNote: parsed.data.location ?? null,
      },
    });

    const user = await tx.user.create({
      data: {
        name: parsed.data.ownerName,
        email,
        phone,
        passwordHash,
        verifiedAt: new Date(),
        shopId: shop.id,
        isAdmin: shouldBeAdmin({ email, phone }),
      },
    });

    await tx.subscription.create({
      data: {
        shopId: shop.id,
        status: "TRIALING",
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        billingCycle: "MONTHLY",
        amountGhs: 59,
        startedAt: new Date(),
      },
    });

    return user;
  });

  await createSessionAndSetCookie(req, res, created.id);
  return ok(res, { userId: created.id }, 201);
});

router.post("/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "VALIDATION_ERROR", "Invalid body.", parsed.error.flatten());

  const target = normalizeTarget(parsed.data.target);
  const password = parsed.data.password;

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: target }, { phone: target }] },
  });
  if (!user || !user.verifiedAt) return fail(res, 400, "BAD_CREDENTIALS", "Invalid credentials.");

  const okPass = await bcrypt.compare(password, user.passwordHash);
  if (!okPass) return fail(res, 400, "BAD_CREDENTIALS", "Invalid credentials.");

  const sub = await prisma.subscription.findFirst({ where: { shopId: user.shopId }, orderBy: { createdAt: "desc" } });
  if (!sub) return fail(res, 402, "SUBSCRIPTION_CANCELLED", "No subscription found.");

  const shouldAdmin = shouldBeAdmin({ email: user.email, phone: user.phone });
  if (user.isAdmin !== shouldAdmin) {
    await prisma.user.update({ where: { id: user.id }, data: { isAdmin: shouldAdmin } });
  }

  await createSessionAndSetCookie(req, res, user.id);
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(`Set-Cookie sent: ${sessionCookieName()}`);
  }
  return ok(res, { userId: user.id }, 200);
});

router.post("/forgot-password", async (req, res) => {
  const parsed = ForgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return ok(res, { sent: true });

  const email = normalizeTarget(parsed.data.email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return ok(res, { sent: true });

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
    console.log(`Password reset link for ${email}: ${resetLink}`);
  }

  if (isSmtpConfigured()) {
    try {
      await smtpTransport().sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || "mysocialhelp00@gmail.com",
        to: email,
        subject: "MySocial password reset",
        text: `Reset your password using this link: ${resetLink}`,
        html: `<p>Reset your password using this link:</p><p><a href="${resetLink}">${resetLink}</a></p>`,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to send password reset email:", error);
    }
  }

  return ok(res, { sent: true });
});

router.post("/reset-password", async (req, res) => {
  const parsed = ResetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "VALIDATION_ERROR", "Invalid body.", parsed.error.flatten());

  const tokenHash = sha256Hex(parsed.data.token);
  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      used: false,
      expiresAt: { gt: new Date() },
    },
  });
  if (!resetToken) return fail(res, 400, "FORBIDDEN", "Invalid or expired token.");

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { used: true } }),
  ]);

  return ok(res, { reset: true });
});

router.post("/logout", async (req, res) => {
  const cookieName = sessionCookieName();
  const token = req.cookies?.[cookieName] as string | undefined;
  if (req.session?.id) clearAdminVerified(req.session.id);
  res.clearCookie(cookieName, clearCookieOpts);
  if (!token) return ok(res, { loggedOut: true }, 200);

  const tokenHash = sha256Hex(token);
  await prisma.session.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  return ok(res, { loggedOut: true }, 200);
});

router.get("/me", requireAuth, async (req, res) => {
  const [shop, subscription] = await Promise.all([
    prisma.shop.findUnique({ where: { id: req.user!.shopId } }),
    prisma.subscription.findFirst({ where: { shopId: req.user!.shopId }, orderBy: { createdAt: "desc" } }),
  ]);
  return ok(res, {
    user: { id: req.user!.id, name: req.user!.name, email: req.user!.email, phone: req.user!.phone, isAdmin: req.user!.isAdmin },
    shop,
    subscription: subscription ? { ...subscription, viewOnly: isViewOnly(subscription) } : null,
  });
});

export default router;
