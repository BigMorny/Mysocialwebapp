import express from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { isViewOnly } from "../middleware/subscription";
import { ok } from "../lib/http";

const router = express.Router();

const PaymentRequestSchema = z.object({
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]),
  method: z.enum(["MOMO", "BANK"]),
  reference: z.string().min(3).max(180),
});

function amountForCycle(cycle: "MONTHLY" | "ANNUAL") {
  return cycle === "MONTHLY" ? 59 : 590;
}

router.get("/payment-info", requireAuth, (_req, res) => {
  return ok(res, {
    momoNumber: process.env.MYSOCIAL_MOMO_NUMBER ?? "",
    momoName: process.env.MYSOCIAL_MOMO_NAME ?? "",
    bankName: process.env.MYSOCIAL_BANK_NAME ?? "",
    bankAccountName: process.env.MYSOCIAL_BANK_ACCOUNT_NAME ?? "",
    bankAccountNumber: process.env.MYSOCIAL_BANK_ACCOUNT_NUMBER ?? "",
  });
});

router.get("/status", requireAuth, async (req, res) => {
  const subscription = await prisma.subscription.findFirst({
    where: { shopId: req.user!.shopId },
    orderBy: { createdAt: "desc" },
  });
  const pendingRequest = await prisma.subscriptionPaymentRequest.findFirst({
    where: { shopId: req.user!.shopId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  return ok(res, { subscription, viewOnly: isViewOnly(subscription), pendingRequest });
});

router.post("/payment-request", requireAuth, async (req, res) => {
  const parsed = PaymentRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid body." });

  const pending = await prisma.subscriptionPaymentRequest.findFirst({
    where: { shopId: req.user!.shopId, status: "PENDING" },
  });
  if (pending) return res.status(409).json({ ok: false, error: "A pending payment request already exists." });

  const created = await prisma.subscriptionPaymentRequest.create({
    data: {
      shopId: req.user!.shopId,
      billingCycle: parsed.data.billingCycle,
      amountGhs: amountForCycle(parsed.data.billingCycle),
      method: parsed.data.method,
      reference: parsed.data.reference,
      status: "PENDING",
    },
  });
  return ok(res, created, 201);
});

export default router;

