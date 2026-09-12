import type { Request, Response, NextFunction } from "express";
import * as analyticsService from "./analytics.service";
import { ok } from "../../lib/respond";

export async function marketAnalyticsHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await analyticsService.marketAnalytics());
  } catch (err) {
    next(err);
  }
}

export async function myAnalyticsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await analyticsService.myAnalytics(req.user!.id));
  } catch (err) {
    next(err);
  }
}
