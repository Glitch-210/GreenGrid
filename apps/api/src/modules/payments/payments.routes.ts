import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";
import { requireIdempotencyKey } from "../../middleware/idempotency.middleware";
import { createPaymentSchema } from "./payments.validator";
import { createPaymentHandler } from "./payments.controller";

export const router = Router();

router.post("/", authMiddleware, requireIdempotencyKey, validate(createPaymentSchema), createPaymentHandler);
