import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../lib/ApiError";
import { logger } from "../lib/logger";
import { fail } from "../lib/respond";

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    // 4xx is the caller's problem and stays quiet. A 5xx ApiError is still a
    // server fault and must be logged — otherwise typing an error (Bug 28) would
    // have silenced the very alarm it was meant to make legible, since only
    // non-ApiErrors reached the logger below.
    if (err.statusCode >= 500) {
      logger.error(err.message, {
        errorCode: err.errorCode,
        statusCode: err.statusCode,
        ...(err.details ?? {}),
      });
    }
    // `details` is deliberately not returned: it is diagnostic context for the
    // operator, not something a client can act on.
    return fail(res, err.statusCode, err.errorCode, err.message);
  }
  logger.error("Unhandled error", { error: err instanceof Error ? err.stack : String(err) });
  return fail(res, 500, "INTERNAL_ERROR", "Something went wrong");
}

export function notFoundMiddleware(req: Request, res: Response) {
  return fail(res, 404, "NOT_FOUND", `No route: ${req.method} ${req.path}`);
}
