import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../lib/ApiError";
import { logger } from "../lib/logger";
import { fail } from "../lib/respond";

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return fail(res, err.statusCode, err.errorCode, err.message);
  }
  logger.error("Unhandled error", { error: err instanceof Error ? err.stack : String(err) });
  return fail(res, 500, "INTERNAL_ERROR", "Something went wrong");
}

export function notFoundMiddleware(req: Request, res: Response) {
  return fail(res, 404, "NOT_FOUND", `No route: ${req.method} ${req.path}`);
}
