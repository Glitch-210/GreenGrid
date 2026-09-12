import { Router } from "express";
import { Role } from "@wattshare/shared";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import { demoClockSchema, demoCongestSchema, demoDiscomSchema } from "./demo.validator";
import { resetHandler, clockHandler, congestHandler, discomHandler } from "./demo.controller";

export const router = Router();

router.use(authMiddleware, requireRole(Role.ADMIN));

router.post("/reset", resetHandler);
router.post("/clock", validate(demoClockSchema), clockHandler);
router.post("/congest", validate(demoCongestSchema), congestHandler);
router.post("/discom", validate(demoDiscomSchema), discomHandler);
