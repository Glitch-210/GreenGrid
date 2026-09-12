import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../lib/ApiError";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      idempotencyKey?: string;
    }
  }
}

/** Requires an `Idempotency-Key` header; the actual dedupe lookup happens in each service. */
export function requireIdempotencyKey(req: Request, _res: Response, next: NextFunction) {
  const key = req.header("Idempotency-Key");
  if (!key) {
    return next(ApiError.badRequest("VALIDATION_ERROR", "Idempotency-Key header is required"));
  }
  req.idempotencyKey = key;
  next();
}
