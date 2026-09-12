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

    // Reject at creation, not just at purchase. Without this the seller publishes
    // happily and the failure surfaces to a buyer at reservation time instead.
    if (credit.expiresAt.getTime() <= Date.now()) {
      throw ApiError.badRequest("CREDIT_EXPIRED", "This credit batch has expired and can no longer be listed");
    }

    const zone = credit.meter.gridZone;
    const price = new Decimal(input.pricePerKwh);
    if (price.lt(zone.priceFloor) || price.gt(zone.priceCeiling)) {
      throw ApiError.badRequest("PRICE_OUT_OF_BAND", `Price must be between ${zone.priceFloor} and ${zone.priceCeiling}`);
    }

    // Mark LISTED only once the whole balance is spoken for. Flipping it on any
    // partial listing removed the credit from the seller's own Sell page and
    // stranded the unlisted remainder (the over-listing guard above already
    // enforces the real limit).
    const fullyListed = qty.plus(listedSoFar).gte(credit.availableKwh);
    if (fullyListed) {
      await tx.energyCredit.update({ where: { id: credit.id }, data: { status: "LISTED" } });
    }

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

    const cancelled = await tx.marketplaceListing.update({ where: { id: listingId }, data: { status: "CANCELLED" } });

    // Listing never held a balance in availableKwh (see createListing), so there is
    // no balance to restore — but the credit may still back OTHER open listings, so
    // recompute rather than assuming this cancellation frees the whole thing.
    const stillListed = await tx.marketplaceListing.aggregate({
      where: { creditId: listing.creditId, status: { in: ["ACTIVE", "PARTIAL"] } },
      _sum: { remainingKwh: true },
    });
    const credit = await tx.energyCredit.findUniqueOrThrow({ where: { id: listing.creditId } });
    const outstanding = stillListed._sum.remainingKwh ?? new Decimal(0);
    if (new Decimal(credit.availableKwh).gt(outstanding) && credit.status === "LISTED") {
      await tx.energyCredit.update({ where: { id: listing.creditId }, data: { status: "AVAILABLE" } });
    }
    await audit(tx, "LISTING_CANCELLED", "MarketplaceListing", listingId, user.id);
    return cancelled;
  });
}

export async function listListings(user: AuthUser, query: ListingsQuery) {
  const orderBy =
    query.sort === "price_desc" ? { pricePerKwh: "desc" as const } : query.sort === "newest" ? { createdAt: "desc" as const } : { pricePerKwh: "asc" as const };

  const listings = await prisma.marketplaceListing.findMany({
    where: {
      // Browsing the market shows only what can still be bought; a seller viewing
      // their own book needs the finished ones too.
      ...(query.mine
        ? { sellerId: user.id }
        : { status: { in: ["ACTIVE", "PARTIAL"] as const } }),
      ...(query.zone ? { zone: { zoneCode: query.zone } } : {}),
      ...(query.minPrice !== undefined ? { pricePerKwh: { gte: query.minPrice } } : {}),
      ...(query.maxPrice !== undefined ? { pricePerKwh: { lte: query.maxPrice } } : {}),
      ...(query.minQty !== undefined ? { remainingKwh: { gte: query.minQty } } : {}),
    },
    include: { seller: { select: { displayAlias: true } }, zone: { select: { name: true, zoneCode: true } } },
    orderBy,
  });

  // Never return seller PII — only displayAlias + zone name (§6). `isOwn` is a
  // derived boolean rather than the raw sellerId, so the client can mark and
  // disable the caller's own listings without learning anyone else's identity.
  return listings.map((l) => ({
    id: l.id,
    sellerAlias: l.seller.displayAlias,
    isOwn: l.sellerId === user.id,
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
