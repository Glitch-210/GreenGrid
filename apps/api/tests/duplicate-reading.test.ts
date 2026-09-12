/**
 * IMPLEMENTATION_PLAN.md §10 — "Duplicate externalId reading → one credit batch only" (H12).
 *
 * ingestReading is idempotent on (meterId, externalId) (a plain findFirst guard, not
 * a DB-enforced upsert), so a genuine concurrent replay can race past that guard and
 * hit the MeterReading unique constraint instead of returning the winner's row. This
 * covers both the sequential case (the spec's literal wording) and that concurrent race.
 *
 * Needs a real Postgres. Runs against DATABASE_URL, or TEST_DATABASE_URL when set
 * (see setup-env.ts).
 */
import { prisma } from "../src/config/prisma";
import { ingestReading, ingestReadingUnchecked } from "../src/modules/meters/meters.service";
import { seedFixture, resetFixture, cleanup, PREFIX, type Fixture } from "./helpers/readings-fixture";
import { Role } from "@wattshare/shared";

jest.setTimeout(30_000);

let fx: Fixture;

beforeAll(async () => {
  await cleanup(); // sweep up any crashed previous run
  fx = await seedFixture();
});

beforeEach(async () => {
  await resetFixture(fx);
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("duplicate-reading dedupe (§10, mandatory)", () => {
  it("returns the same MeterReading row when the same externalId is ingested twice in sequence", async () => {
    const input = {
      externalId: "DSTEST-ext-seq",
      timestamp: new Date(),
      generationKwh: 5,
      consumptionKwh: 1,
    };

    const first = await ingestReadingUnchecked(fx.meterId, input);
    const second = await ingestReadingUnchecked(fx.meterId, { ...input, timestamp: new Date(Date.now() + 60_000) });

    expect(second.id).toBe(first.id);

    const rows = await prisma.meterReading.findMany({ where: { meterId: fx.meterId, externalId: input.externalId } });
    expect(rows).toHaveLength(1);
  });

  it("returns the same MeterReading row when two concurrent ingestReading calls race", async () => {
    const input = {
      externalId: "DSTEST-ext-race",
      timestamp: new Date(),
      generationKwh: 5,
      consumptionKwh: 1,
    };

    // Kick both off before awaiting so they genuinely overlap and race past the
    // leading findFirst dedupe check together.
    const a = ingestReadingUnchecked(fx.meterId, input);
    const b = ingestReadingUnchecked(fx.meterId, input);
    const results = await Promise.allSettled([a, b]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ id: string }>[];
    const rejected = results.filter((r) => r.status === "rejected");

    // Without the P2002 catch-and-refetch in ingestReading, the loser rejects
    // with a raw Prisma unique-constraint error instead of returning the winner's row.
    expect(rejected).toHaveLength(0);
    expect(fulfilled).toHaveLength(2);
    expect(fulfilled[0].value.id).toBe(fulfilled[1].value.id);

    const rows = await prisma.meterReading.findMany({ where: { meterId: fx.meterId, externalId: input.externalId } });
    expect(rows).toHaveLength(1);
  });

  // Bug 4: POST /meters/:id/readings had no ownership check, so any authenticated
  // user could inject readings into anyone's meter — and a reading with surplus
  // mints real credits. Reported as 404 so the id's existence isn't confirmed.
  it("refuses to ingest a reading into a meter the caller does not own", async () => {
    const stranger = { id: "00000000-0000-0000-0000-0000000000ff", role: Role.PROSUMER, email: "stranger@test.invalid" };
    const input = {
      externalId: "DSTEST-ext-notmine",
      timestamp: new Date(),
      generationKwh: 5,
      consumptionKwh: 1,
    };

    await expect(ingestReading(stranger, fx.meterId, input)).rejects.toMatchObject({ statusCode: 404 });

    const rows = await prisma.meterReading.findMany({ where: { meterId: fx.meterId, externalId: input.externalId } });
    expect(rows).toHaveLength(0);
  });

  it("lets the meter's own owner ingest", async () => {
    const owner = { id: fx.ownerId, role: Role.PROSUMER, email: `${PREFIX}meter-owner@test.invalid` };
    const reading = await ingestReading(owner, fx.meterId, {
      externalId: "DSTEST-ext-mine",
      timestamp: new Date(),
      generationKwh: 5,
      consumptionKwh: 1,
    });
    expect(reading.meterId).toBe(fx.meterId);
  });
});
