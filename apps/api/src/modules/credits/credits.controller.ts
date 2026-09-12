import type { Request, Response, NextFunction } from "express";
import * as creditEngine from "./credit-engine.service";
import { ok } from "../../lib/respond";

export async function listCreditsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, sellable } = req.query as { status?: any; sellable?: boolean };
    const credits = await creditEngine.listCreditsForOwner(req.user!.id, status, sellable);
    ok(res, credits);
  } catch (err) {
    next(err);
  }
}

export async function getCreditHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const credit = await creditEngine.getCreditById(req.user!, req.params.id);
    ok(res, credit);
  } catch (err) {
    next(err);
  }
}

export async function generateCreditHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const credit = await creditEngine.mintFromReading(req.body.readingId, req.user!);
    ok(res, credit, undefined, 201);
  } catch (err) {
    next(err);
  }
}
