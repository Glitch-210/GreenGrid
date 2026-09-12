import type { Request, Response, NextFunction } from "express";
import * as authService from "./auth.service";
import { ok } from "../../lib/respond";

export async function registerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.register(req.body);
    ok(res, result, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function meHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.me(req.user!.id);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}
