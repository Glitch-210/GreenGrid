import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/prisma";
import { ok } from "../../lib/respond";
import { ApiError } from "../../lib/ApiError";
import { assertCanReadAny } from "../../lib/authorize";

export async function getSettlementHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const settlement = await prisma.settlement.findUnique({
      where: { id: req.params.id },
      include: { transaction: { select: { buyerId: true, sellerId: true, matches: { select: { sellerId: true } } } } },
    });
    if (!settlement) throw ApiError.notFound("Settlement not found");
    // The consumer owns the bill adjustment, but the sellers whose credits were
    // retired are parties too — and DISCOM/regulator need it for reconciliation.
    assertCanReadAny(
      req.user!,
      [
        settlement.consumerId,
        settlement.transaction?.buyerId,
        settlement.transaction?.sellerId,
        ...(settlement.transaction?.matches.map((m) => m.sellerId) ?? []),
      ],
      "Settlement",
    );
    const { transaction: _omit, ...row } = settlement;
    ok(res, row);
  } catch (err) {
    next(err);
  }
}
