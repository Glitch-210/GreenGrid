import type { Request, Response, NextFunction } from "express";
import * as paymentsService from "./payments.service";
import { ok } from "../../lib/respond";

export async function createPaymentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await paymentsService.createPayment(req.body, req.idempotencyKey!);
    ok(res, payment, undefined, 201);
  } catch (err) {
    next(err);
  }
}
