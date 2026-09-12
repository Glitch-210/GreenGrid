/**
 * Scoped fixture for the §10 idempotent-payment integration test.
 *
 * Everything it creates carries the DSTEST- prefix on a natural key, and cleanup()
 * deletes exactly those rows. It seeds a Transaction directly in RESERVED status
 * (bypassing createTransaction) since createPayment only cares about the state
 * machine, not how the transaction got there. It seeds zero EnergyMatch rows so
 * transferOnChain's "nothing to move" branch runs (no listing/credit needed).
 */
import { prisma } from "../../src/config/prisma";

export const PREFIX = "DSTEST-";

const ZONE_CODE = `${PREFIX}PAYGZ`;

export interface Fixture {
  zoneId: string;
  buyerId: string;
  sellerId: string;
  transactionId: string; // Transaction.id (uuid) — what createPayment takes
}

export async function seedFixture(): Promise<Fixture> {
  const zone = await prisma.gridZone.create({
    data: {
      zoneCode: ZONE_CODE,
      name: "Payment idempotency test zone",
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
      name: "DSTest Pay Seller",
      email: `${PREFIX}pay-seller@test.invalid`,
      passwordHash: "x",
      role: "PROSUMER",
      displayAlias: `${PREFIX}Pay-Seller`,
    },
  });

  const buyer = await prisma.user.create({
    data: {
      name: "DSTest Pay Buyer",
      email: `${PREFIX}pay-buyer@test.invalid`,
      passwordHash: "x",
      role: "CONSUMER",
      displayAlias: `${PREFIX}Pay-Buyer`,
    },
  });

  const txn = await createReservedTransaction(zone.id, buyer.id, seller.id);

  return { zoneId: zone.id, buyerId: buyer.id, sellerId: seller.id, transactionId: txn.id };
}

async function createReservedTransaction(gridZoneId: string, buyerId: string, sellerId: string) {
  return prisma.transaction.create({
    data: {
      transactionId: `${PREFIX}TXN-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      buyerId,
      sellerId,
      quantityKwh: 10,
      pricePerKwh: 4.2,
      totalAmount: 42,
      platformFee: 1,
      sellerPayout: 41,
      status: "RESERVED",
      gridZoneId,
    },
  });
}

/** Wipes the fixture's Payment/Settlement rows and gives it a fresh RESERVED transaction. */
export async function resetFixture(fx: Fixture): Promise<Fixture> {
  await prisma.settlement.deleteMany({ where: { transactionId: fx.transactionId } });
  await prisma.payment.deleteMany({ where: { transactionId: fx.transactionId } });
  await prisma.transaction.delete({ where: { id: fx.transactionId } });

  const txn = await createReservedTransaction(fx.zoneId, fx.buyerId, fx.sellerId);
  return { ...fx, transactionId: txn.id };
}

/**
 * Deletes every DSTEST- payment-fixture row in reverse FK order. Matches on
 * prefixed natural keys rather than ids captured this run, so a crashed
 * previous run is swept up too.
 */
export async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: `${PREFIX}pay-` } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) {
    await dropZone();
    return;
  }

  const txns = await prisma.transaction.findMany({ where: { buyerId: { in: userIds } }, select: { id: true } });
  const txnIds = txns.map((t) => t.id);

  await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { entityId: { in: txnIds } }] } });
  await prisma.settlement.deleteMany({ where: { transactionId: { in: txnIds } } });
  await prisma.payment.deleteMany({ where: { transactionId: { in: txnIds } } });
  await prisma.transaction.deleteMany({ where: { id: { in: txnIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await dropZone();
}

async function dropZone() {
  const zone = await prisma.gridZone.findUnique({ where: { zoneCode: ZONE_CODE }, select: { id: true } });
  if (!zone) return;
  await prisma.energyPrice.deleteMany({ where: { gridZoneId: zone.id } });
  await prisma.gridStatus.deleteMany({ where: { gridZoneId: zone.id } });
  await prisma.gridZone.delete({ where: { id: zone.id } });
}
