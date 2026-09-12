import type { Request, Response, NextFunction } from "express";
import * as usersService from "./users.service";
import { ok } from "../../lib/respond";

export async function dashboardHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await usersService.getDashboard(req.user!);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}
