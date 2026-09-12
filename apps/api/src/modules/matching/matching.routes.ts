import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";
import { findMatchesSchema } from "./matching.validator";
import { findMatchesHandler } from "./matching.controller";

export const router = Router();

router.post("/find", authMiddleware, validate(findMatchesSchema), findMatchesHandler);
