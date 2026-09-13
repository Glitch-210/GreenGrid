import { Router } from "express";
import { Role } from "@wattshare/shared";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import { createMeterSchema, ingestReadingSchema, paginationQuerySchema } from "./meters.validator";
import {
  createMeterHandler,
  listMyMetersHandler,
  getMeterHandler,
  listReadingsHandler,
  ingestReadingHandler,
} from "./meters.controller";

export const router = Router();

router.post("/", authMiddleware, requireRole(Role.PROSUMER), validate(createMeterSchema), createMeterHandler);
// Without these the readings endpoint was unreachable by its intended caller:
// it needs a meter id and nothing told a prosumer what their own ids were.
router.get("/", authMiddleware, listMyMetersHandler);
router.get("/:id", authMiddleware, getMeterHandler);
router.get("/:id/readings", authMiddleware, validate(paginationQuerySchema, "query"), listReadingsHandler);
router.post("/:id/readings", authMiddleware, validate(ingestReadingSchema), ingestReadingHandler);
