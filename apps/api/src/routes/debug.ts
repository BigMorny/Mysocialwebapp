import express from "express";
import { ok, fail } from "../lib/http";
import { requireAuth } from "../middleware/auth";

const router = express.Router();

router.get("/debug/me", requireAuth, (req, res) => {
  if (!req.user) return fail(res, 401, "UNAUTHORIZED", "Authentication required.");

  const cookieName = process.env.SESSION_COOKIE_NAME || "mysocial_session";
  let cookieSource: "signed" | "unsigned" | "none" = "none";
  if ((req as any).signedCookies?.[cookieName]) cookieSource = "signed";
  else if ((req as any).cookies?.[cookieName]) cookieSource = "unsigned";

  const subscription = req.subscription
    ? {
        id: req.subscription.id,
        status: req.subscription.status,
        billingCycle: req.subscription.billingCycle,
        amountGhs: req.subscription.amountGhs,
      }
    : null;

  return ok(res, {
    user: {
      id: req.user.id,
      email: req.user.email,
      phone: req.user.phone,
      shopId: req.user.shopId,
      isAdmin: req.user.isAdmin,
    },
    subscription,
    cookieSource: process.env.NODE_ENV === "production" ? undefined : cookieSource,
  });
});

router.get("/debug/cookies", (req, res) => {
  const cookieName = process.env.SESSION_COOKIE_NAME || "mysocial_session";
  const hasSessionCookie =
    Boolean((req as any).signedCookies?.[cookieName]) || Boolean((req as any).cookies?.[cookieName]);

  return ok(res, {
    headerCookie: req.headers.cookie ?? null,
    parsedCookies: {
      cookieKeys: Object.keys((req as any).cookies || {}),
      signedCookieKeys: Object.keys((req as any).signedCookies || {}),
    },
    hasSessionCookie,
    sessionCookieName: cookieName,
    origin: (req.headers.origin as string) ?? null,
  });
});

export default router;


