import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { fail } from "../lib/respond";

type Source = "body" | "query" | "params";

export function validate(schema: ZodSchema, source: Source = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return fail(res, 400, "VALIDATION_ERROR", result.error.errors.map((e) => e.message).join("; "));
    }
    (req as any)[source] = result.data;
    next();
  };
}
