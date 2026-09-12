import { prisma } from "../../config/prisma";
import { Decimal } from "../../lib/decimal";
import { ApiError } from "../../lib/ApiError";
import { audit } from "../../lib/audit";
import { emitToZone } from "../../sockets/io";
import { SOCKET_EVENTS } from "../../sockets/events";
import type { CreateListingInput, ListingsQuery } from "@wattshare/shared";
import type { AuthUser } from "../../middleware/auth.middleware";

export async function createListing(user: AuthUser, input: CreateListingInput) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "EnergyCredit" WHERE id = ${input.creditId} FOR UPDATE`;
    const credit = await tx.energyCredit.findUniqueOrThrow({ where: { id: input.creditId }, include: { meter: { include: { gridZone: true } } } });

    if (credit.ownerId !== user.id) throw ApiError.forbidden("Not your credit");

    // Listing does NOT move balance out of availableKwh — only an actual buyer
    // reservation does that (§5.6). Guard against over-listing the same credit
    // across multiple concurrent listings by checking what's already spoken for.
    const alreadyListed = await tx.marketplaceListing.aggregate({
      where: { creditId: credit.id, status: { in: ["ACTIVE", "PARTIAL"] } },
      _sum: { remainingKwh: true },
    });
    const qty = new Decimal(input.quantityKwh);
    const listedSoFar = alreadyListed._sum.remainingKwh ?? new Decimal(0);
    if (qty.plus(listedSoFar).gt(credit.availableKwh)) {
      throw ApiError.badRequest("INSUFFICIENT_CREDITS", "Not enough available EC to list");
    }

    const zone = credit.meter.gridZone;
    const price = new Decimal(input.pricePerKwh);
    if (price.lt(zone.priceFloor) || price.gt(zone.priceCeiling)) {
      throw ApiError.badRequest("PRICE_OUT_OF_BAND", `Price must be between ${zone.priceFloor} and ${zone.priceCeiling}`);
    }

    await tx.energyCredit.update({ where: { id: credit.id }, data: { status: "LISTED" } });

    const listing = await tx.marketplaceListing.create({
      data: {
        sellerId: user.id,
        creditId: credit.id,
        gridZoneId: zone.id,
        quantityKwh: qty,
        remainingKwh: qty,
        pricePerKwh: price,
        expiresAt: credit.expiresAt,
      },
    });

    await audit(tx, "LISTING_CREATED", "MarketplaceListing", listing.id, user.id, { quantityKwh: qty.toString(), price: price.toString() });
    return listing;
  }).then((listing) => {
    emitToZone(listing.gridZoneId, SOCKET_EVENTS.MARKETPLACE_UPDATE, { type: "created", listingId: listing.id });
    return listing;
  });
}

export async function cancelListing(user: AuthUser, listingId: string) {
  return prisma.$transaction(async (tx) => {
    const listing = await tx.marketplaceListing.findUnique({ where: { id: listingId } });
    if (!listing) throw ApiError.notFound("Listing not found");
    if (listing.sellerId !== user.id) throw ApiError.forbidden("Not your listing");
    if (!["ACTIVE", "PARTIAL"].includes(listing.status)) {
      throw ApiError.conflict("VALIDATION_ERROR", "Only active/partial listings can be cancelled");
    }

    // Listing never held a balance in availableKwh (see createListing), so cancelling
    // it just frees the credit back to AVAILABLE status — no balance to restore.
    await tx.energyCredit.update({ where: { id: listing.creditId }, data: { status: "AVAILABLE" } });

    const cancelled = await tx.marketplaceListing.update({ where: { id: listingId }, data: { status: "CANCELLED" } });
    await audit(tx, "LISTING_CANCELLED", "MarketplaceListing", listingId, user.id);
    return cancelled;
  });
}

export async function listListings(query: ListingsQuery) {
  const orderBy =
    query.sort === "price_desc" ? { pricePerKwh: "desc" as const } : query.sort === "newest" ? { createdAt: "desc" as const } : { pricePerKwh: "asc" as const };

  const listings = await prisma.marketplaceListing.findMany({
    where: {
      status: { in: ["ACTIVE", "PARTIAL"] },
      ...(query.zone ? { zone: { zoneCode: query.zone } } : {}),
      ...(query.minPrice !== undefined ? { pricePerKwh: { gte: query.minPrice } } : {}),
      ...(query.maxPrice !== undefined ? { pricePerKwh: { lte: query.maxPrice } } : {}),
      ...(query.minQty !== undefined ? { remainingKwh: { gte: query.minQty } } : {}),
    },
    include: { seller: { select: { displayAlias: true } }, zone: { select: { name: true, zoneCode: true } } },
    orderBy,
  });

  // Never return seller PII — only displayAlias + zone name (§6)
  return listings.map((l) => ({
    id: l.id,
    sellerAlias: l.seller.displayAlias,
    creditId: l.creditId,
    gridZoneId: l.gridZoneId,
    zoneName: l.zone.name,
    zoneCode: l.zone.zoneCode,
    quantityKwh: l.quantityKwh.toFixed(4),
    remainingKwh: l.remainingKwh.toFixed(4),
    pricePerKwh: l.pricePerKwh.toFixed(4),
    status: l.status,
    createdAt: l.createdAt,
    expiresAt: l.expiresAt,
  }));
}
