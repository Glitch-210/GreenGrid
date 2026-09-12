import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/prisma";
import { ok } from "../../lib/respond";
import { ApiError } from "../../lib/ApiError";

export async function getSettlementHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const settlement = await prisma.settlement.findUnique({ where: { id: req.params.id } });
    if (!settlement) throw ApiError.notFound("Settlement not found");
    ok(res, settlement);
  } catch (err) {
    next(err);
  }
}
