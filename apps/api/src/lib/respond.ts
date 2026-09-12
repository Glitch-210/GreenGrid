import type { Response } from "express";

export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
}

export function fail(res: Response, status: number, errorCode: string, message: string) {
  return res.status(status).json({ success: false, message, errorCode });
}
