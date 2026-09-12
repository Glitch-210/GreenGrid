import type { Request, Response, NextFunction } from "express";
import * as transactionsService from "./transactions.service";
import { ok } from "../../lib/respond";

export async function createTransactionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const txn = await transactionsService.createTransaction(req.user!, req.body, req.idempotencyKey!);
    ok(res, txn, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function listTransactionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await transactionsService.listTransactions(req.user!));
  } catch (err) {
    next(err);
  }
}

export async function getTransactionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await transactionsService.getTransaction(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function cancelTransactionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await transactionsService.cancelTransaction(req.user!, req.params.id));
  } catch (err) {
    next(err);
  }
}
