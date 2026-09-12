import { Router } from "express";
import { Role } from "@wattshare/shared";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import { generateCreditSchema, creditsQuerySchema } from "./credits.validator";
import { listCreditsHandler, getCreditHandler, generateCreditHandler } from "./credits.controller";

export const router = Router();

router.get("/", authMiddleware, validate(creditsQuerySchema, "query"), listCreditsHandler);
router.get("/:id", authMiddleware, getCreditHandler);
router.post("/generate", authMiddleware, requireRole(Role.PROSUMER), validate(generateCreditSchema), generateCreditHandler);
