import type { NextFunction, Request, Response } from "express";
import { fail } from "../lib/http";
import { prisma } from "../lib/prisma";
import { sha256Hex } from "../lib/crypto";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.session) {
    const token = req.cookies.mysocial_session as string | undefined;
    if (token) {
      const tokenHash = sha256Hex(token);
      const session = await prisma.session.findFirst({
        where: { tokenHash, revokedAt: null },
        include: { user: true, device: true },
      });
      if (session) {
        req.session = session;
        req.user = session.user;
        req.device = session.device;
      }
    }
  }

  if (!req.user || !req.session) {
    return fail(res, 401, "UNAUTHORIZED", "Authentication required.");
  }
  return next();
}


