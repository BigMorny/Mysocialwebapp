import type { NextFunction, Request, Response } from "express";
import { fail } from "../lib/http";

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function originCheck(req: Request, res: Response, next: NextFunction) {
  if (!STATE_CHANGING.has(req.method)) return next();
  // If called by a browser, Origin should be present for fetch() POSTs.
  const origin = req.headers.origin;
  const allowed = process.env.WEB_ORIGIN;

  if (!allowed) return next();
  if (!origin) {
    return fail(res, 403, "FORBIDDEN", "Missing Origin header.");
  }
  if (origin !== allowed) {
    return fail(res, 403, "FORBIDDEN", "Invalid Origin.");
  }
  return next();
}


