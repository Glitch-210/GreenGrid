import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";
import { requireIdempotencyKey } from "../../middleware/idempotency.middleware";
import { createTransactionSchema } from "./transactions.validator";
import {
  createTransactionHandler,
  listTransactionsHandler,
  getTransactionHandler,
  cancelTransactionHandler,
} from "./transactions.controller";

export const router = Router();

router.post("/", authMiddleware, requireIdempotencyKey, validate(createTransactionSchema), createTransactionHandler);
router.get("/", authMiddleware, listTransactionsHandler);
router.get("/:id", authMiddleware, getTransactionHandler);
router.post("/:id/cancel", authMiddleware, cancelTransactionHandler);
