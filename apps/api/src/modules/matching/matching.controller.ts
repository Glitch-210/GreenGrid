import type { Request, Response, NextFunction } from "express";
import * as matchingEngine from "./matching-engine.service";
import { ok } from "../../lib/respond";

export async function findMatchesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await matchingEngine.findMatches(req.user!.id, req.body);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}
