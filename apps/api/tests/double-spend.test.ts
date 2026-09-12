/**
 * IMPLEMENTATION_PLAN.md §10 — the mandatory double-spend integration test.
 *
 * Two buyers race for the same last 100 EC. The atomic core (createTransaction:
 * Serializable + `SELECT … FOR UPDATE` on listing and credit, locked in listingId
 * ASC order) must let exactly one of them through.
 *
 * Needs a real Postgres: row locks and serialization failures cannot be mocked.
 * Runs against DATABASE_URL, or TEST_DATABASE_URL when set (see setup-env.ts).
 */
import { prisma } from "../src/config/prisma";
import { Decimal } from "../src/lib/decimal";
import { createTransaction, cancelTransaction } from "../src/modules/transactions/transactions.service";
import { ApiError } from "../src/lib/ApiError";
import { seedFixture, resetFixture, cleanup, type Fixture } from "./helpers/double-spend-fixture";
import type { AuthUser } from "../src/middleware/auth.middleware";
import { Role } from "@wattshare/shared";

jest.setTimeout(30_000);

let fx: Fixture;
let buyer1: AuthUser;
let buyer2: AuthUser;

beforeAll(async () => {
  await cleanup(); // sweep up any crashed previous run
  fx = await seedFixture();
  [buyer1, buyer2] = fx.buyers;
});

beforeEach(async () => {
  await resetFixture(fx);
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

const buy = (buyer: AuthUser, kwh: number, key: string) =>
  createTransaction(buyer, { allocations: [{ listingId: fx.listingId, kwh }] }, key);

/**
 * Two interleavings are possible. If the winner had already committed, the loser's
 * re-read sees remainingKwh = 0 and throws INSUFFICIENT_CREDITS directly. If the loser
 * opened its snapshot first it blocks on FOR UPDATE and Postgres raises 40001 — but
 * createTransaction retries once on that, and the retry then hits the same clean
 * INSUFFICIENT_CREDITS. So the buyer never sees a raw Postgres/Prisma error either way.
 */
function expectLostTheRace(reason: unknown) {
  expect(reason).toBeInstanceOf(ApiError);
  expect((reason as ApiError).errorCode).toBe("INSUFFICIENT_CREDITS");
  expect((reason as ApiError).statusCode).toBe(409);
}

async function readState() {
  const [credit, listing, txns, matches] = await Promise.all([
    prisma.energyCredit.findUniqueOrThrow({ where: { id: fx.creditId } }),
    prisma.marketplaceListing.findUniqueOrThrow({ where: { id: fx.listingId } }),
    prisma.transaction.findMany({ where: { buyerId: { in: [buyer1.id, buyer2.id] } } }),
    prisma.energyMatch.findMany({ where: { listingId: fx.listingId, status: "RESERVED" } }),
  ]);
  return { credit, listing, txns, matches };
}

describe("double-spend race (§10, mandatory)", () => {
  it("lets exactly one of two concurrent full-quantity purchases through", async () => {
    // Kick both off before awaiting so the transactions genuinely overlap.
    const a = buy(buyer1, 100, "DSTEST-key-full-1");
    const b = buy(buyer2, 100, "DSTEST-key-full-2");
    const results = await Promise.allSettled([a, b]);

    const winners = results.filter((r) => r.status === "fulfilled");
    const losers = results.filter((r) => r.status === "rejected");
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);

    expectLostTheRace((losers[0] as PromiseRejectedResult).reason);

    const won = (winners[0] as PromiseFulfilledResult<{ id: string; status: string; quantityKwh: unknown }>).value;
    expect(won.status).toBe("RESERVED");
    expect(new Decimal(won.quantityKwh as never).toFixed(4)).toBe("100.0000");

    const { credit, listing, txns, matches } = await readState();

    // The whole point: the 100 EC moved once, not twice.
    expect(txns).toHaveLength(1);
    expect(matches).toHaveLength(1);

    expect(new Decimal(credit.availableKwh).toFixed(4)).toBe("0.0000");
    expect(new Decimal(credit.reservedKwh).toFixed(4)).toBe("100.0000");
    expect(credit.status).toBe("RESERVED");

    expect(new Decimal(listing.remainingKwh).toFixed(4)).toBe("0.0000");
    expect(listing.status).toBe("RESERVED");

    // §10 invariant: available + reserved + sold + retired == quantity
    const sum = new Decimal(credit.availableKwh).plus(credit.reservedKwh).plus(credit.soldKwh).plus(credit.retiredKwh);
    expect(sum.toFixed(4)).toBe(new Decimal(credit.quantityKwh).toFixed(4));
  });

  it("rejects the second of two concurrent 60 EC purchases against 100 EC", async () => {
    // 60 + 60 = 120 > 100. A naive read-then-write would let both commit and
    // drive availableKwh negative; the row locks must stop the second.
    const a = buy(buyer1, 60, "DSTEST-key-partial-1");
    const b = buy(buyer2, 60, "DSTEST-key-partial-2");
    const results = await Promise.allSettled([a, b]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const losers = results.filter((r) => r.status === "rejected");
    expect(losers).toHaveLength(1);
    expectLostTheRace((losers[0] as PromiseRejectedResult).reason);

    const { credit, listing, matches } = await readState();

    expect(matches).toHaveLength(1);
    expect(new Decimal(credit.availableKwh).toFixed(4)).toBe("40.0000");
    expect(new Decimal(credit.reservedKwh).toFixed(4)).toBe("60.0000");
    expect(new Decimal(credit.availableKwh).gte(0)).toBe(true);

    expect(new Decimal(listing.remainingKwh).toFixed(4)).toBe("40.0000");
    expect(listing.status).toBe("PARTIAL");

    const sum = new Decimal(credit.availableKwh).plus(credit.reservedKwh).plus(credit.soldKwh).plus(credit.retiredKwh);
    expect(sum.toFixed(4)).toBe(new Decimal(credit.quantityKwh).toFixed(4));
  });

  it("returns the same transaction for a replayed idempotency key", async () => {
    const key = "DSTEST-key-idem";
    const first = await buy(buyer1, 10, key);
    const second = await buy(buyer1, 10, key);
    expect(second.id).toBe(first.id);

    const rows = await prisma.transaction.findMany({ where: { idempotencyKey: key } });
    expect(rows).toHaveLength(1);
  });
});

/**
 * Bug 10: createTransaction never compared the listing's seller to the buyer, so a
 * prosumer could buy their own credits — moving no energy and paying the platform
 * fee for the privilege. The marketplace projection also omits sellerId, so the
 * client could not have filtered these out on its own.
 */
describe("self-trade guard (Bug 10)", () => {
  const asSeller = (): AuthUser => ({ id: fx.sellerId, role: Role.PROSUMER, email: "seller@test.invalid" });

  it("refuses a seller buying their own listing", async () => {
    await expect(buy(asSeller(), 10, "DSTEST-selftrade-1")).rejects.toMatchObject({ errorCode: "SELF_TRADE" });
  });

  it("refuses a basket that mixes someone else's listing with the buyer's own", async () => {
    await expect(
      createTransaction(
        asSeller(),
        { allocations: [{ listingId: fx.listingId, kwh: 5 }, { listingId: fx.listingId, kwh: 5 }] },
        "DSTEST-selftrade-2",
      ),
    ).rejects.toMatchObject({ errorCode: "SELF_TRADE" });
  });

  it("still lets a genuine third-party buyer through", async () => {
    const txn = await buy(buyer1, 10, "DSTEST-selftrade-ok");
    expect(txn.status).toBe("RESERVED");
  });
});

/**
 * Bug 11: reservedKwh was written via `.toNumber()`, rounding a Decimal(18,4) balance
 * through float64 and breaking `available + reserved + sold + retired == quantity`.
 * Bug 31: a listing restored to its full quantity stayed PARTIAL.
 */
describe("decimal precision and listing restoration (Bugs 11, 31)", () => {
  it("keeps the credit balance invariant exact across reserve and release", async () => {
    // A quantity with a fractional part that float64 cannot hold exactly.
    const txn = await buy(buyer1, 33.3333, "DSTEST-decimal-1");

    const mid = await prisma.energyCredit.findUniqueOrThrow({ where: { id: fx.creditId } });
    const midSum = new Decimal(mid.availableKwh).plus(mid.reservedKwh).plus(mid.soldKwh).plus(mid.retiredKwh);
    expect(midSum.equals(new Decimal(mid.quantityKwh))).toBe(true);
    expect(new Decimal(mid.reservedKwh).equals(new Decimal("33.3333"))).toBe(true);

    await cancelTransaction(buyer1, txn.id);

    const after = await prisma.energyCredit.findUniqueOrThrow({ where: { id: fx.creditId } });
    const afterSum = new Decimal(after.availableKwh).plus(after.reservedKwh).plus(after.soldKwh).plus(after.retiredKwh);
    expect(afterSum.equals(new Decimal(after.quantityKwh))).toBe(true);
    expect(new Decimal(after.reservedKwh).isZero()).toBe(true);

    const listing = await prisma.marketplaceListing.findUniqueOrThrow({ where: { id: fx.listingId } });
    expect(new Decimal(listing.remainingKwh).equals(new Decimal(listing.quantityKwh))).toBe(true);
    // Bug 31: fully restored, so ACTIVE — not carried forward as PARTIAL.
    expect(listing.status).toBe("ACTIVE");
  });
});
