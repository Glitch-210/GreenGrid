import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { listNotificationsHandler, markReadHandler } from "./notifications.controller";

export const router = Router();

router.get("/", authMiddleware, listNotificationsHandler);
router.patch("/:id/read", authMiddleware, markReadHandler);
