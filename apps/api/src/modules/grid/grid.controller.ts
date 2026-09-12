import type { Request, Response, NextFunction } from "express";
import * as gridService from "./grid.service";
import { ok } from "../../lib/respond";

export async function listZonesHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await gridService.listZones());
  } catch (err) {
    next(err);
  }
}

export async function zoneStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await gridService.getZoneStatus(req.params.id));
  } catch (err) {
    next(err);
  }
}
