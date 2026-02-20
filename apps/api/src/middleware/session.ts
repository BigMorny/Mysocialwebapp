import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { fail } from "../lib/http";
import { sha256Hex } from "../lib/crypto";

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const TOUCH_EVERY_MS = 60 * 1000;
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "mysocial_session";
const COOKIE_MAX_AGE = FIVE_HOURS_MS;

export async function sessionMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!token) return next();

  const tokenHash = sha256Hex(token);
  const session = await prisma.session.findFirst({
    where: { tokenHash, revokedAt: null },
    include: { user: true, device: true },
  });

  if (!session) return next();

  const now = Date.now();
  const last = session.lastActivityAt.getTime();

  if (now - last > FIVE_HOURS_MS) {
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });
    return fail(res, 401, "SESSION_EXPIRED", "Session expired due to inactivity.");
  }

  req.session = session;
  req.user = session.user;
  req.device = session.device;

  // Keep cookie/session rolling with activity while preserving current auth flow.
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  if (now - last > TOUCH_EVERY_MS) {
    // best-effort; don't block request on failure
    prisma.session
      .update({ where: { id: session.id }, data: { lastActivityAt: new Date() } })
      .catch(() => undefined);
  }

  return next();
}


