/**
 * Scoped fixture for the §10 double-spend integration test.
 *
 * Everything it creates carries the DSTEST- prefix on a natural key, and cleanup()
 * deletes exactly those rows. It never truncates, so it is safe to run against the
 * shared dev database without touching seeded demo data.
 */
import { prisma } from "../../src/config/prisma";
import { Role } from "@wattshare/shared";
import type { AuthUser } from "../../src/middleware/auth.middleware";

export const PREFIX = "DSTEST-";

const ZONE_CODE = `${PREFIX}GZ`;
const METER_NUMBER = `${PREFIX}M1`;
const CREDIT_ID = `${PREFIX}EC-1`;

export interface Fixture {
  zoneId: string;
  sellerId: string;
  buyers: AuthUser[];
  creditId: string;
  listingId: string;
}

/** 100 EC, fully available, sitting on one ACTIVE listing in an uncongested zone. */
export async function seedFixture(): Promise<Fixture> {
  const zone = await prisma.gridZone.create({
    data: {
      zoneCode: ZONE_CODE,
      name: "Double-spend test zone",
      // canTrade() rejects the trade outright if it exceeds capacity - load,
      // so leave plenty of headroom above the 100 kWh under test.
      capacityKw: 10000,
      currentLoadKw: 0,
      basePrice: 4,
      priceFloor: 2.5,
      priceCeiling: 7,
      lossFactor: 0.87,
    },
  });

  const seller = await prisma.user.create({
    data: {
      name: "DSTest Seller",
      email: `${PREFIX}seller@test.invalid`,
      passwordHash: "x",
      role: "PROSUMER",
      displayAlias: `${PREFIX}Seller`,
    },
  });

  const buyerRows = await Promise.all(
    [1, 2].map((n) =>
      prisma.user.create({
        data: {
          name: `DSTest Buyer ${n}`,
          email: `${PREFIX}buyer${n}@test.invalid`,
          passwordHash: "x",
          role: "CONSUMER",
          displayAlias: `${PREFIX}Buyer-${n}`,
        },
      }),
    ),
  );

  const meter = await prisma.meter.create({
    data: {
      meterNumber: METER_NUMBER,
      userId: seller.id,
      gridZoneId: zone.id,
      meterType: "SOLAR",
      ratedKw: 10,
    },
  });

  // EnergyCredit.readingId is @unique and required — one reading backs the batch.
  const reading = await prisma.meterReading.create({
    data: {
      meterId: meter.id,
      externalId: `${PREFIX}R1`,
      timestamp: new Date(),
      generationKwh: 150,
      consumptionKwh: 50,
      surplusKwh: 100,
      status: "VERIFIED",
      creditIssued: true,
      payloadHash: `${PREFIX}hash-1`,
    },
  });

  const credit = await prisma.energyCredit.create({
    data: {
      creditId: CREDIT_ID,
      ownerId: seller.id,
      sourceMeterId: meter.id,
      readingId: reading.id,
      quantityKwh: 100,
      availableKwh: 100,
      status: "LISTED",
      gridZoneId: zone.id,
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    },
  });

  const listing = await prisma.marketplaceListing.create({
    data: {
      sellerId: seller.id,
      creditId: credit.id,
      gridZoneId: zone.id,
      quantityKwh: 100,
      remainingKwh: 100,
      pricePerKwh: 4.2,
      status: "ACTIVE",
      expiresAt: credit.expiresAt,
    },
  });

  return {
    zoneId: zone.id,
    sellerId: seller.id,
    buyers: buyerRows.map((b) => ({ id: b.id, role: Role.CONSUMER, email: b.email })),
    creditId: credit.id,
    listingId: listing.id,
  };
}

/**
 * Puts the fixture back to "100 EC, untouched, one ACTIVE listing" by discarding
 * whatever the previous case reserved. Keeps the cases order-independent so a
 * failure in one doesn't cascade into the rest.
 */
export async function resetFixture(fx: Fixture) {
  const buyerIds = fx.buyers.map((b) => b.id);
  const txns = await prisma.transaction.findMany({ where: { buyerId: { in: buyerIds } }, select: { id: true } });
  await prisma.energyMatch.deleteMany({ where: { buyerId: { in: buyerIds } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: txns.map((t) => t.id) } } });
  await prisma.transaction.deleteMany({ where: { id: { in: txns.map((t) => t.id) } } });

  await prisma.energyCredit.update({
    where: { id: fx.creditId },
    data: { availableKwh: 100, reservedKwh: 0, soldKwh: 0, retiredKwh: 0, status: "LISTED" },
  });
  await prisma.marketplaceListing.update({
    where: { id: fx.listingId },
    data: { remainingKwh: 100, status: "ACTIVE" },
  });
}

/**
 * Deletes every DSTEST- row in reverse FK order. Matches on prefixed natural keys
 * rather than ids captured this run, so a crashed previous run is swept up too.
 */
export async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) {
    await dropZone();
    return;
  }

  const txns = await prisma.transaction.findMany({ where: { buyerId: { in: userIds } }, select: { id: true } });
  const txnIds = txns.map((t) => t.id);
  const listings = await prisma.marketplaceListing.findMany({ where: { sellerId: { in: userIds } }, select: { id: true } });
  const credits = await prisma.energyCredit.findMany({ where: { ownerId: { in: userIds } }, select: { id: true } });

  await prisma.auditLog.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { entityId: { in: [...txnIds, ...listings.map((l) => l.id), ...credits.map((c) => c.id)] } }] },
  });
  await prisma.energyMatch.deleteMany({ where: { buyerId: { in: userIds } } });
  await prisma.settlement.deleteMany({ where: { transactionId: { in: txnIds } } });
  await prisma.payment.deleteMany({ where: { transactionId: { in: txnIds } } });
  await prisma.transaction.deleteMany({ where: { id: { in: txnIds } } });
  await prisma.marketplaceListing.deleteMany({ where: { sellerId: { in: userIds } } });
  await prisma.energyCredit.deleteMany({ where: { ownerId: { in: userIds } } });
  // Delete readings by meter, not by our externalId prefix: if a meter simulator is
  // running against this database it writes SIM-prefixed readings onto the fixture's
  // meter, and those survive a prefix match and then block the meter delete
  // (MeterReading_meterId_fkey is RESTRICT).
  const fixtureMeters = await prisma.meter.findMany({ where: { meterNumber: { startsWith: PREFIX } }, select: { id: true } });
  const fixtureMeterIds = fixtureMeters.map((m) => m.id);
  if (fixtureMeterIds.length > 0) {
    const strayReadings = await prisma.meterReading.findMany({ where: { meterId: { in: fixtureMeterIds } }, select: { id: true } });
    await prisma.energyCredit.deleteMany({ where: { readingId: { in: strayReadings.map((r) => r.id) } } });
    await prisma.meterReading.deleteMany({ where: { meterId: { in: fixtureMeterIds } } });
  }
  await prisma.meter.deleteMany({ where: { meterNumber: { startsWith: PREFIX } } });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await dropZone();
}

/** GridZone is RESTRICT-referenced by EnergyPrice/GridStatus, so clear those first. */
async function dropZone() {
  const zone = await prisma.gridZone.findUnique({ where: { zoneCode: ZONE_CODE }, select: { id: true } });
  if (!zone) return;
  await prisma.energyPrice.deleteMany({ where: { gridZoneId: zone.id } });
  await prisma.gridStatus.deleteMany({ where: { gridZoneId: zone.id } });
  await prisma.gridZone.delete({ where: { id: zone.id } });
}

export interface ManyListingsFixture {
  zoneId: string;
  sellerId: string;
  buyer: AuthUser;
  listingIds: string[];
}

/**
 * `count` separate ACTIVE listings (one credit each, `kwhEach` EC) for one seller in an
 * uncongested zone — used to exercise a purchase that spans many allocations in one
 * `createTransaction` call (the many-round-trip / pooler-drop scenario for large
 * multi-allocation purchases). Reuses the DSTEST- prefix/cleanup used by the single-listing
 * fixture above; run cleanup()/seedFixture() must not both be relied on in the same test run.
 */
export async function seedManyListingsFixture(count: number, kwhEach: number): Promise<ManyListingsFixture> {
  const zone = await prisma.gridZone.create({
    data: {
      zoneCode: `${ZONE_CODE}-MANY`,
      name: "Multi-allocation test zone",
      capacityKw: 100000,
      currentLoadKw: 0,
      basePrice: 4,
      priceFloor: 2.5,
      priceCeiling: 7,
      lossFactor: 0.87,
    },
  });

  const seller = await prisma.user.create({
    data: {
      name: "DSTest Many Seller",
      email: `${PREFIX}many-seller@test.invalid`,
      passwordHash: "x",
      role: "PROSUMER",
      displayAlias: `${PREFIX}Many-Seller`,
    },
  });

  const buyerRow = await prisma.user.create({
    data: {
      name: "DSTest Many Buyer",
      email: `${PREFIX}many-buyer@test.invalid`,
      passwordHash: "x",
      role: "CONSUMER",
      displayAlias: `${PREFIX}Many-Buyer`,
    },
  });

  const meter = await prisma.meter.create({
    data: {
      meterNumber: `${METER_NUMBER}-MANY`,
      userId: seller.id,
      gridZoneId: zone.id,
      // CONSUMER (not SOLAR/BIDIRECTIONAL) so the live simulator's tick
      // (meterType in [SOLAR, BIDIRECTIONAL] + status ACTIVE) never picks this
      // meter up and injects extra readings/credits during the test.
      meterType: "CONSUMER",
      ratedKw: 100,
    },
  });

  const listingIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const reading = await prisma.meterReading.create({
      data: {
        meterId: meter.id,
        externalId: `${PREFIX}MANY-R${i}`,
        timestamp: new Date(Date.now() - i * 1000),
        generationKwh: kwhEach + 5,
        consumptionKwh: 5,
        surplusKwh: kwhEach,
        status: "VERIFIED",
        creditIssued: true,
        payloadHash: `${PREFIX}many-hash-${i}`,
      },
    });
    const credit = await prisma.energyCredit.create({
      data: {
        creditId: `${PREFIX}MANY-EC-${i}`,
        ownerId: seller.id,
        sourceMeterId: meter.id,
        readingId: reading.id,
        quantityKwh: kwhEach,
        availableKwh: kwhEach,
        status: "LISTED",
        gridZoneId: zone.id,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      },
    });
    const listing = await prisma.marketplaceListing.create({
      data: {
        sellerId: seller.id,
        creditId: credit.id,
        gridZoneId: zone.id,
        quantityKwh: kwhEach,
        remainingKwh: kwhEach,
        pricePerKwh: 4.2,
        status: "ACTIVE",
        expiresAt: credit.expiresAt,
      },
    });
    listingIds.push(listing.id);
  }

  return {
    zoneId: zone.id,
    sellerId: seller.id,
    buyer: { id: buyerRow.id, role: Role.CONSUMER, email: buyerRow.email },
    listingIds,
  };
}

/** Deletes everything created by seedManyListingsFixture, matching on the -MANY suffix. */
export async function cleanupManyListingsFixture() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: `${PREFIX}many-` } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  if (userIds.length > 0) {
    const txns = await prisma.transaction.findMany({ where: { buyerId: { in: userIds } }, select: { id: true } });
    const txnIds = txns.map((t) => t.id);
    await prisma.auditLog.deleteMany({ where: { entityId: { in: txnIds } } });
    await prisma.energyMatch.deleteMany({ where: { buyerId: { in: userIds } } });
    await prisma.transaction.deleteMany({ where: { id: { in: txnIds } } });
    await prisma.marketplaceListing.deleteMany({ where: { sellerId: { in: userIds } } });
    await prisma.energyCredit.deleteMany({ where: { ownerId: { in: userIds } } });
    const manyMeters = await prisma.meter.findMany({ where: { meterNumber: { endsWith: "-MANY" } }, select: { id: true } });
    const manyMeterIds = manyMeters.map((m) => m.id);
    if (manyMeterIds.length > 0) {
      const strayReadings = await prisma.meterReading.findMany({ where: { meterId: { in: manyMeterIds } }, select: { id: true } });
      await prisma.energyCredit.deleteMany({ where: { readingId: { in: strayReadings.map((r) => r.id) } } });
      await prisma.meterReading.deleteMany({ where: { meterId: { in: manyMeterIds } } });
    }
    await prisma.meter.deleteMany({ where: { meterNumber: { endsWith: "-MANY" } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  const zone = await prisma.gridZone.findUnique({ where: { zoneCode: `${ZONE_CODE}-MANY` }, select: { id: true } });
  if (zone) {
    await prisma.energyPrice.deleteMany({ where: { gridZoneId: zone.id } });
    await prisma.gridStatus.deleteMany({ where: { gridZoneId: zone.id } });
    await prisma.gridZone.delete({ where: { id: zone.id } });
  }
}
