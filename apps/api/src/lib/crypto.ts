import crypto from "crypto";

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function randomTokenHex(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function normalizeTarget(target: string): string {
  return target.trim().toLowerCase();
}


