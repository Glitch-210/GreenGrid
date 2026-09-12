import type { Request, Response, NextFunction } from "express";
import * as marketplaceService from "./marketplace.service";
import { ok } from "../../lib/respond";

export async function createListingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const listing = await marketplaceService.createListing(req.user!, req.body);
    ok(res, listing, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function cancelListingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const listing = await marketplaceService.cancelListing(req.user!, req.params.id);
    ok(res, listing);
  } catch (err) {
    next(err);
  }
}

export async function listListingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const listings = await marketplaceService.listListings(req.query as any);
    ok(res, listings);
  } catch (err) {
    next(err);
  }
}
