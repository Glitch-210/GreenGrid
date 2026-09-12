import type { Request, Response, NextFunction } from "express";
import * as pricingEngine from "./pricing-engine.service";
import { ok } from "../../lib/respond";
import { ApiError } from "../../lib/ApiError";

export async function currentPriceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const zone = req.query.zone as string;
    if (!zone) throw ApiError.badRequest("VALIDATION_ERROR", "zone query param required");
    const price = await pricingEngine.getCurrentPrice(zone);
    ok(res, price);
  } catch (err) {
    next(err);
  }
}

export async function priceHistoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const zone = req.query.zone as string;
    const hours = Number(req.query.hours ?? 24);
    if (!zone) throw ApiError.badRequest("VALIDATION_ERROR", "zone query param required");
    const history = await pricingEngine.getPriceHistory(zone, hours);
    ok(res, history);
  } catch (err) {
    next(err);
  }
}
