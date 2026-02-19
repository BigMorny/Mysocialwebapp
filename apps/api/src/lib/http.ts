import type { Response } from "express";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "SESSION_EXPIRED"
  | "DEVICE_LIMIT_REACHED"
  | "SUBSCRIPTION_PAST_DUE"
  | "SUBSCRIPTION_CANCELLED"
  | "OTP_SEND_LIMIT"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "OTP_TOO_MANY_ATTEMPTS"
  | "BAD_CREDENTIALS"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INTERNAL_ERROR";

export function ok<T>(res: Response, data: T, status: number = 200) {
  return res.status(status).json({ ok: true, data });
}

export function fail(
  res: Response,
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
) {
  return res.status(status).json({
    ok: false,
    error: {
      code,
      message,
      details,
    },
  });
}


