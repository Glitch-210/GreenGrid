import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { dashboardHandler, meHandler } from "./users.controller";

export const router = Router();

router.get("/me", authMiddleware, meHandler);
router.get("/dashboard", authMiddleware, dashboardHandler);

