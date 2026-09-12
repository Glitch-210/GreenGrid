/**
 * Regression test for the "large multi-allocation purchase" bug: `createTransaction`
 * used to do ~7 sequential round-trips per allocated listing inside one interactive
 * transaction, which could exceed the transaction timeout / get the connection dropped
 * by a pooler for purchases spanning 20-40 listings. This exercises exactly that shape.
 *
 * Needs a real Postgres: row locks and serialization failures cannot be mocked.
 */
import { prisma } from "../src/config/prisma";
import { Decimal } from "../src/lib/decimal";
import { createTransaction } from "../src/modules/transactions/transactions.service";
import {
  seedManyListingsFixture,
  cleanupManyListingsFixture,
  type ManyListingsFixture,
} from "./helpers/double-spend-fixture";

jest.setTimeout(30_000);

const LISTING_COUNT = 30;
const KWH_EACH = 2;

let fx: ManyListingsFixture;

beforeAll(async () => {
  await cleanupManyListingsFixture();
  fx = await seedManyListingsFixture(LISTING_COUNT, KWH_EACH);
});

afterAll(async () => {
  await cleanupManyListingsFixture();
  await prisma.$disconnect();
});

describe("multi-allocation purchase", () => {
  it(`completes a purchase spanning ${LISTING_COUNT} listings in one call`, async () => {
    const allocations = fx.listingIds.map((listingId) => ({ listingId, kwh: KWH_EACH }));

    const txn = await createTransaction(fx.buyer, { allocations }, "MULTITEST-key-1");

    expect(txn.status).toBe("RESERVED");
    expect(new Decimal(txn.quantityKwh as never).toFixed(4)).toBe(new Decimal(LISTING_COUNT * KWH_EACH).toFixed(4));

    const matches = await prisma.energyMatch.findMany({ where: { transactionId: txn.id } });
    expect(matches).toHaveLength(LISTING_COUNT);

    const listings = await prisma.marketplaceListing.findMany({ where: { id: { in: fx.listingIds } } });
    for (const listing of listings) {
      expect(new Decimal(listing.remainingKwh).toFixed(4)).toBe("0.0000");
      expect(listing.status).toBe("RESERVED");
    }

    const credits = await prisma.energyCredit.findMany({ where: { ownerId: fx.sellerId } });
    for (const credit of credits) {
      expect(new Decimal(credit.availableKwh).toFixed(4)).toBe("0.0000");
      expect(new Decimal(credit.reservedKwh).toFixed(4)).toBe(KWH_EACH.toFixed(4));
      expect(credit.status).toBe("RESERVED");
    }
  });
});
