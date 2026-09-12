import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";
import { createMeterSchema, ingestReadingSchema, paginationQuerySchema } from "./meters.validator";
import { createMeterHandler, listReadingsHandler, ingestReadingHandler } from "./meters.controller";

export const router = Router();

router.post("/", authMiddleware, validate(createMeterSchema), createMeterHandler);
router.get("/:id/readings", authMiddleware, validate(paginationQuerySchema, "query"), listReadingsHandler);
router.post("/:id/readings", authMiddleware, validate(ingestReadingSchema), ingestReadingHandler);
