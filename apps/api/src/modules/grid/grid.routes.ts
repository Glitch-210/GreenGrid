import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { listZonesHandler, zoneStatusHandler } from "./grid.controller";

export const router = Router();

router.get("/zones", authMiddleware, listZonesHandler);
router.get("/zones/:id/status", authMiddleware, zoneStatusHandler);
