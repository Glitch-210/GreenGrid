import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { dashboardHandler } from "./users.controller";

export const router = Router();

router.get("/dashboard", authMiddleware, dashboardHandler);
