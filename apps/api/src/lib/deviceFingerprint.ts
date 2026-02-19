import type { Request } from "express";
import { sha256Hex } from "./crypto";

export function getDeviceUuidFromCookie(req: Request): string | null {
  const v = req.cookies?.device_id as string | undefined;
  if (!v) return null;
  if (v.length < 8 || v.length > 128) return null;
  return v;
}

export function computeFingerprintHash(req: Request): string | null {
  const uuid = getDeviceUuidFromCookie(req);
  if (!uuid) return null;

  const ua = (req.headers["user-agent"] ?? "").toString();
  const platform =
    (req.headers["sec-ch-ua-platform"] ?? "").toString() ||
    (req.headers["x-platform"] ?? "").toString();

  const raw = `${ua}|${platform}|${uuid}`;
  return sha256Hex(raw);
}


