import { Router } from "express";
import { registerHandler, loginHandler, meHandler } from "./auth.controller";
import { registerSchema, loginSchema } from "./auth.validator";
import { validate } from "../../middleware/validation.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";
import { loginRateLimit } from "../../middleware/rateLimit.middleware";

export const router = Router();

router.post("/register", validate(registerSchema), registerHandler);
router.post("/login", loginRateLimit, validate(loginSchema), loginHandler);
router.get("/me", authMiddleware, meHandler);
