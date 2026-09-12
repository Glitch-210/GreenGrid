import type { Request, Response, NextFunction } from "express";
import * as notificationsService from "./notifications.service";
import { ok } from "../../lib/respond";

export async function listNotificationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await notificationsService.listNotifications(req.user!.id));
  } catch (err) {
    next(err);
  }
}

export async function markReadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await notificationsService.markRead(req.user!.id, req.params.id));
  } catch (err) {
    next(err);
  }
}
