/**
 * Scoped fixture for the §10 duplicate-reading integration test.
 *
 * Everything it creates carries the DSTEST- prefix on a natural key, and cleanup()
 * deletes exactly those rows. Uses its own zone/meter/user natural keys (distinct
 * from double-spend-fixture.ts and payments-fixture.ts) so the three test files can
 * run as concurrent Jest workers against the same database without colliding.
 */
import { prisma } from "../../src/config/prisma";

export const PREFIX = "DSTEST-";

const ZONE_CODE = `${PREFIX}METGZ`;
const METER_NUMBER = `${PREFIX}METM1`;

export interface Fixture {
  zoneId: string;
  ownerId: string;
  meterId: string;
}

export async function seedFixture(): Promise<Fixture> {
  const zone = await prisma.gridZone.create({
    data: {
      zoneCode: ZONE_CODE,
      name: "Duplicate-reading test zone",
      capacityKw: 10000,
      currentLoadKw: 0,
      basePrice: 4,
      priceFloor: 2.5,
      priceCeiling: 7,
      lossFactor: 0.87,
    },
  });

  const owner = await prisma.user.create({
    data: {
      name: "DSTest Meter Owner",
      email: `${PREFIX}meter-owner@test.invalid`,
      passwordHash: "x",
      role: "PROSUMER",
      displayAlias: `${PREFIX}Meter-Owner`,
    },
  });

  const meter = await prisma.meter.create({
    data: {
      meterNumber: METER_NUMBER,
      userId: owner.id,
      gridZoneId: zone.id,
      meterType: "SOLAR",
      ratedKw: 10,
      status: "ACTIVE",
    },
  });

  return { zoneId: zone.id, ownerId: owner.id, meterId: meter.id };
}

/**
 * Clears out any readings the previous case created, keeping the meter itself.
 *
 * EnergyCredit.readingId is FK RESTRICT, so credits minted from these readings must
 * go first. That happens whenever the meter simulator is running against the same
 * database (the dev server's scheduler will happily tick this fixture's meter), so
 * the delete order matters even though the tests themselves never mint.
 */
export async function resetFixture(fx: Fixture) {
  await deleteReadingsForMeters([fx.meterId]);
}

/** Deletes readings for the given meters, clearing dependent credits first. */
async function deleteReadingsForMeters(meterIds: string[]) {
  if (meterIds.length === 0) return;
  const readings = await prisma.meterReading.findMany({ where: { meterId: { in: meterIds } }, select: { id: true } });
  const readingIds = readings.map((r) => r.id);
  if (readingIds.length > 0) {
    const credits = await prisma.energyCredit.findMany({ where: { readingId: { in: readingIds } }, select: { id: true } });
    const creditIds = credits.map((c) => c.id);
    if (creditIds.length > 0) {
      await prisma.marketplaceListing.deleteMany({ where: { creditId: { in: creditIds } } });
      await prisma.energyCredit.deleteMany({ where: { id: { in: creditIds } } });
    }
  }
  await prisma.meterReading.deleteMany({ where: { meterId: { in: meterIds } } });
}

/**
 * Deletes every DSTEST- readings-fixture row in reverse FK order. Matches on
 * prefixed natural keys rather than ids captured this run, so a crashed
 * previous run is swept up too.
 */
export async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: `${PREFIX}meter-` } }, select: { id: true } });
  const userIds = users.map((u) => u.id);

  if (userIds.length > 0) {
    const meters = await prisma.meter.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
    await deleteReadingsForMeters(meters.map((m) => m.id));
    await prisma.meter.deleteMany({ where: { meterNumber: { startsWith: METER_NUMBER } } });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  await dropZone();
}

async function dropZone() {
  const zone = await prisma.gridZone.findUnique({ where: { zoneCode: ZONE_CODE }, select: { id: true } });
  if (!zone) return;
  await prisma.energyPrice.deleteMany({ where: { gridZoneId: zone.id } });
  await prisma.gridStatus.deleteMany({ where: { gridZoneId: zone.id } });
  await prisma.gridZone.delete({ where: { id: zone.id } });
}
