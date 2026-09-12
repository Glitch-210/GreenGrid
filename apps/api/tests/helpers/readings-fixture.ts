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

/** Clears out any readings the previous case created, keeping the meter itself. */
export async function resetFixture(fx: Fixture) {
  await prisma.meterReading.deleteMany({ where: { meterId: fx.meterId } });
}

/**
 * Deletes every DSTEST- readings-fixture row in reverse FK order. Matches on
 * prefixed natural keys rather than ids captured this run, so a crashed
 * previous run is swept up too.
 */
export async function cleanup() {
  await prisma.meterReading.deleteMany({ where: { externalId: { startsWith: PREFIX } }, });
  const users = await prisma.user.findMany({ where: { email: { startsWith: `${PREFIX}meter-` } }, select: { id: true } });
  const userIds = users.map((u) => u.id);

  if (userIds.length > 0) {
    await prisma.meterReading.deleteMany({ where: { meter: { userId: { in: userIds } } } });
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
