/**
 * IMPLEMENTATION_PLAN.md §10 — "Idempotent payment: same key twice → one Payment row" (H26).
 *
 * createPayment is idempotent on Payment.transactionId (a plain findFirst guard, not
 * a DB-enforced upsert), so a genuine concurrent replay can race past that guard and
 * hit the transactionId unique constraint instead of returning the winner's row. This
 * covers both the sequential case (the spec's literal wording) and that concurrent race.
 *
 * Needs a real Postgres. Runs against DATABASE_URL, or TEST_DATABASE_URL when set
 * (see setup-env.ts).
 */
import { prisma } from "../src/config/prisma";
import { createPayment } from "../src/modules/payments/payments.service";
import { seedFixture, resetFixture, cleanup, type Fixture } from "./helpers/payments-fixture";

jest.setTimeout(30_000);

let fx: Fixture;

beforeAll(async () => {
  await cleanup(); // sweep up any crashed previous run
  fx = await seedFixture();
});

beforeEach(async () => {
  fx = await resetFixture(fx);
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("idempotent payment (§10, mandatory)", () => {
  it("returns the same Payment row when the same transaction is paid twice in sequence", async () => {
    const input = { transactionId: fx.transactionId };
    const first = await createPayment(input, "DSTEST-key-pay-seq");
    const second = await createPayment(input, "DSTEST-key-pay-seq");

    expect(second.id).toBe(first.id);

    const rows = await prisma.payment.findMany({ where: { transactionId: fx.transactionId } });
    expect(rows).toHaveLength(1);
  });

  it("returns the same Payment row when two concurrent createPayment calls race", async () => {
    const input = { transactionId: fx.transactionId };

    // Kick both off before awaiting so they genuinely overlap and race past the
    // leading findFirst guard together.
    const a = createPayment(input, "DSTEST-key-pay-race-1");
    const b = createPayment(input, "DSTEST-key-pay-race-2");
    const results = await Promise.allSettled([a, b]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ id: string }>[];
    const rejected = results.filter((r) => r.status === "rejected");

    // Without the P2002 catch-and-refetch in createPayment, the loser rejects
    // with a raw Prisma unique-constraint error instead of returning the winner's row.
    expect(rejected).toHaveLength(0);
    expect(fulfilled).toHaveLength(2);
    expect(fulfilled[0].value.id).toBe(fulfilled[1].value.id);

    const rows = await prisma.payment.findMany({ where: { transactionId: fx.transactionId } });
    expect(rows).toHaveLength(1);
  });
});
