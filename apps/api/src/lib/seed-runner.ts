/**
 * §9 seed data — tuned to the demo script. Populates the real Neon `hackout` DB.
 * Lives under src/ (not prisma/) so it can be imported both by the standalone
 * `prisma/seed.ts` CLI script and by the admin "Reset data" endpoint in-process.
 */
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { Decimal } from "decimal.js";
import crypto from "crypto";
import { bellCurve, jitter, eligibleCreditKwh } from "./calculations";
import { env } from "../config/env";

const DEMO_PASSWORD = "demo1234";
const CONSUMPTION_PROFILE_KW = [0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.8, 1.2, 1.0, 0.8, 0.7, 0.7, 0.8, 0.8, 0.7, 0.7, 0.9, 1.3, 1.8, 1.6, 1.2, 0.8, 0.5, 0.4];

function payloadHash(meterId: string, externalId: string, timestamp: Date, gen: string, cons: string) {
  return crypto.createHash("sha256").update(`${meterId}|${externalId}|${timestamp.toISOString()}|${gen}|${cons}`).digest("hex");
}

let creditSeq = 0;
function nextCreditId(zoneCode: string, date: Date) {
  creditSeq += 1;
  const shortZone = zoneCode.replace(/[^A-Z0-9]/gi, "").slice(0, 5).toUpperCase();
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `EC-${shortZone}-${y}${m}${d}-${String(creditSeq).padStart(4, "0")}`;
}

let txnSeq = 0;
function nextTxnId(date: Date) {
  txnSeq += 1;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `TXN-${y}${m}${d}-${String(txnSeq).padStart(4, "0")}`;
}

export async function runSeed(prisma: PrismaClient) {
  console.log("Clearing existing data...");
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.settlement.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.energyMatch.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.marketplaceListing.deleteMany(),
    prisma.energyCredit.deleteMany(),
    prisma.meterReading.deleteMany(),
    prisma.meter.deleteMany(),
    prisma.energyPrice.deleteMany(),
    prisma.gridStatus.deleteMany(),
    prisma.user.deleteMany(),
    prisma.gridZone.deleteMany(),
  ]);

  console.log("Creating zones...");
  const zoneW = await prisma.gridZone.create({
    data: {
      zoneCode: "GZ-AHM-W",
      name: "Ahmedabad West",
      capacityKw: 1000,
      currentLoadKw: 620,
      basePrice: 4.0,
      priceFloor: 2.5,
      priceCeiling: 7.0,
      lossFactor: 0.87,
      neighbourCodes: ["GZ-AHM-E"],
    },
  });
  const zoneE = await prisma.gridZone.create({
    data: {
      zoneCode: "GZ-AHM-E",
      name: "Ahmedabad East",
      capacityKw: 800,
      currentLoadKw: 300,
      basePrice: 4.1,
      priceFloor: 2.5,
      priceCeiling: 7.0,
      lossFactor: 0.88,
      neighbourCodes: ["GZ-AHM-W"],
    },
  });

  console.log("Creating users...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  async function makeUser(name: string, email: string, role: "PROSUMER" | "CONSUMER" | "UTILITY" | "REGULATOR" | "ADMIN", alias: string) {
    return prisma.user.create({ data: { name, email, passwordHash, role, displayAlias: alias } });
  }

  const prosumer1 = await makeUser("Prosumer One", "prosumer1@demo.in", "PROSUMER", "Solar-Pro-101");
  const prosumer2 = await makeUser("Prosumer Two", "prosumer2@demo.in", "PROSUMER", "Solar-Pro-102");
  const prosumer3 = await makeUser("Prosumer Three", "prosumer3@demo.in", "PROSUMER", "Solar-Pro-103");
  const prosumer4 = await makeUser("Prosumer Four", "prosumer4@demo.in", "PROSUMER", "Solar-Pro-104");
  const consumer1 = await makeUser("Consumer One", "consumer1@demo.in", "CONSUMER", "Consumer-201");
  const consumer2 = await makeUser("Consumer Two", "consumer2@demo.in", "CONSUMER", "Consumer-202");
  const consumer3 = await makeUser("Consumer Three", "consumer3@demo.in", "CONSUMER", "Consumer-203");
  await makeUser("Utility Ops", "utility@demo.in", "UTILITY", "Utility-001");
  await makeUser("Regulator", "regulator@demo.in", "REGULATOR", "Regulator-001");
  await makeUser("Admin", "admin@demo.in", "ADMIN", "Admin-001");

  console.log("Creating meters...");
  const meter1 = await prisma.meter.create({ data: { meterNumber: "MTR-101", userId: prosumer1.id, gridZoneId: zoneW.id, meterType: "BIDIRECTIONAL", ratedKw: 6 } });
  const meter2 = await prisma.meter.create({ data: { meterNumber: "MTR-102", userId: prosumer2.id, gridZoneId: zoneW.id, meterType: "BIDIRECTIONAL", ratedKw: 12 } });
  const meter3 = await prisma.meter.create({ data: { meterNumber: "MTR-103", userId: prosumer3.id, gridZoneId: zoneE.id, meterType: "BIDIRECTIONAL", ratedKw: 4 } });
  const meter4 = await prisma.meter.create({ data: { meterNumber: "MTR-104", userId: prosumer4.id, gridZoneId: zoneW.id, meterType: "BIDIRECTIONAL", ratedKw: 8, status: "FLAGGED" } });

  console.log("Generating 48h of 15-min readings + minting credits...");
  const meters = [
    { meter: meter1, zone: zoneW, targetKwh: 130 },
    { meter: meter2, zone: zoneW, targetKwh: 400 },
    { meter: meter3, zone: zoneE, targetKwh: 90 },
    { meter: meter4, zone: zoneW, targetKwh: 0 }, // FLAGGED meter — no credits, fraud demo
  ];

  const now = new Date();
  const intervalsPerDay = 96; // 24h * 4 (15-min)
  const totalIntervals = intervalsPerDay * 2; // 48h
  const startTime = new Date(now.getTime() - totalIntervals * 15 * 60_000);

  for (const { meter, zone, targetKwh } of meters) {
    let externalIdCounter = 0;
    const eligibleAccum: Decimal[] = [];

    // First pass: compute raw eligible-per-interval to find a scale factor hitting targetKwh over the last day
    const rawEligiblePerInterval: { ts: Date; gen: Decimal; cons: Decimal }[] = [];
    for (let i = 0; i < totalIntervals; i++) {
      const ts = new Date(startTime.getTime() + i * 15 * 60_000);
      const hour = ts.getUTCHours();
      const solarK = bellCurve(hour);
      const gen = new Decimal(meter.ratedKw).times(solarK).times(jitter(0.9, 1.1)).times(0.25);
      const cons = new Decimal(CONSUMPTION_PROFILE_KW[hour]).times(jitter(0.85, 1.15)).times(0.25);
      rawEligiblePerInterval.push({ ts, gen, cons });
    }

    // scale so the most recent day's eligible sum ≈ targetKwh (skip for the flagged/no-credit meter)
    const lastDay = rawEligiblePerInterval.slice(intervalsPerDay);
    const rawSum = lastDay.reduce((sum, r) => sum.plus(eligibleCreditKwh(r.gen, r.cons, zone.lossFactor)), new Decimal(0));
    const scale = targetKwh > 0 && rawSum.gt(0) ? new Decimal(targetKwh).div(rawSum) : new Decimal(0);

    const readingRows = rawEligiblePerInterval.map((r, i) => {
      const gen = meter.status === "FLAGGED" ? r.gen : r.gen.times(i >= intervalsPerDay ? scale : 1);
      const cons = r.cons;
      const surplus = Decimal.max(0, gen.minus(cons));
      return {
        meterId: meter.id,
        externalId: `SEED-${meter.meterNumber}-${externalIdCounter++}`,
        timestamp: r.ts,
        generationKwh: gen,
        consumptionKwh: cons,
        importKwh: Decimal.max(0, cons.minus(gen)),
        exportKwh: surplus,
        surplusKwh: surplus,
        status: meter.status === "FLAGGED" ? ("FLAGGED" as const) : ("VERIFIED" as const),
        flagReason: meter.status === "FLAGGED" ? "GENERATION_EXCEEDS_RATED_CAPACITY" : null,
        creditIssued: false,
        payloadHash: payloadHash(meter.id, `SEED-${meter.meterNumber}-${i}`, r.ts, gen.toString(), cons.toString()),
      };
    });

    await prisma.meterReading.createMany({ data: readingRows });
    console.log(`  ${meter.meterNumber}: inserted ${readingRows.length} readings`);

    if (meter.status === "FLAGGED") continue; // no credits for the fraud-demo meter

    // Mint credits only from the last day's VERIFIED readings, to keep the seeded credit count reasonable
    const mintableReadings = await prisma.meterReading.findMany({
      where: { meterId: meter.id, status: "VERIFIED", timestamp: { gte: new Date(startTime.getTime() + intervalsPerDay * 15 * 60_000) } },
      orderBy: { timestamp: "asc" },
    });

    // Aggregate the day's eligible readings into a single clean credit batch per prosumer
    // (one row per meter here, not one per 15-min reading) so the demo has one credit ID
    // to point at instead of 70+ micro-batches.
    const eligibleByReading: { reading: (typeof mintableReadings)[number]; eligible: Decimal }[] = [];
    for (const reading of mintableReadings) {
      const eligible = eligibleCreditKwh(reading.generationKwh, reading.consumptionKwh, zone.lossFactor);
      if (eligible.lte(0)) continue;
      eligibleByReading.push({ reading, eligible });
    }

    if (eligibleByReading.length > 0) {
      const totalMinted = eligibleByReading.reduce((s, r) => s.plus(r.eligible), new Decimal(0));
      const lastReading = eligibleByReading[eligibleByReading.length - 1].reading;
      const expiresAt = new Date(lastReading.timestamp.getTime() + 72 * 3_600_000);

      await prisma.energyCredit.create({
        data: {
          creditId: nextCreditId(zone.zoneCode, lastReading.timestamp),
          ownerId: meter.userId,
          sourceMeterId: meter.id,
          readingId: lastReading.id,
          quantityKwh: totalMinted,
          availableKwh: totalMinted,
          status: "AVAILABLE",
          gridZoneId: zone.id,
          generatedAt: lastReading.timestamp,
          expiresAt,
        },
      });
      await prisma.meterReading.updateMany({
        where: { id: { in: eligibleByReading.map((r) => r.reading.id) } },
        data: { creditIssued: true },
      });
      eligibleAccum.push(totalMinted);
    }

    const totalMinted = eligibleAccum.reduce((s, v) => s.plus(v), new Decimal(0));
    console.log(`  ${meter.meterNumber}: minted ${totalMinted.toFixed(2)} EC across ${eligibleAccum.length} batches`);
  }

  console.log("Creating listings (P1 130 EC @ ₹4.20, P2 400 EC @ ₹4.10, P3 90 EC @ ₹4.30)...");
  async function listSomeCredits(ownerId: string, targetQty: number, price: number, zoneId: string) {
    const credits = await prisma.energyCredit.findMany({ where: { ownerId, status: "AVAILABLE" }, orderBy: { createdAt: "asc" } });
    let remaining = new Decimal(targetQty);
    for (const credit of credits) {
      if (remaining.lte(0)) break;
      const take = Decimal.min(remaining, credit.availableKwh);
      if (take.lte(0)) continue;

      // Listing does not move balance out of availableKwh — only a buyer reservation does (§5.6).
      await prisma.energyCredit.update({ where: { id: credit.id }, data: { status: "LISTED" } });
      await prisma.marketplaceListing.create({
        data: {
          sellerId: ownerId,
          creditId: credit.id,
          gridZoneId: zoneId,
          quantityKwh: take,
          remainingKwh: take,
          pricePerKwh: price,
          expiresAt: credit.expiresAt,
        },
      });
      remaining = remaining.minus(take);
    }
  }

  await listSomeCredits(prosumer1.id, 130, 4.2, zoneW.id);
  await listSomeCredits(prosumer2.id, 400, 4.1, zoneW.id);
  await listSomeCredits(prosumer3.id, 90, 4.3, zoneE.id);

  console.log("Creating ~12 historical completed transactions for analytics...");
  const buyers = [consumer1, consumer2, consumer3];
  const sellers = [
    { user: prosumer1, meter: meter1, zone: zoneW },
    { user: prosumer2, meter: meter2, zone: zoneW },
    { user: prosumer3, meter: meter3, zone: zoneE },
  ];

  for (let i = 0; i < 12; i++) {
    const buyer = buyers[i % buyers.length];
    const seller = sellers[i % sellers.length];
    const qty = new Decimal(20 + (i % 5) * 10);
    const price = new Decimal(4.0 + (i % 3) * 0.1);
    const total = qty.times(price);
    // Same rate the live engine charges, so seeded history matches real trades.
    const fee = total.times(env.platformFeeRate);
    const payout = total.minus(fee);
    const createdAt = new Date(now.getTime() - (12 - i) * 3_600_000 * 4);

    const txn = await prisma.transaction.create({
      data: {
        transactionId: nextTxnId(createdAt),
        buyerId: buyer.id,
        sellerId: seller.user.id,
        quantityKwh: qty,
        pricePerKwh: price,
        totalAmount: total,
        platformFee: fee,
        sellerPayout: payout,
        status: "COMPLETED",
        gridZoneId: seller.zone.id,
        blockchainTxHash: `0xsim${crypto.randomBytes(29).toString("hex")}`,
        createdAt,
        completedAt: new Date(createdAt.getTime() + 5 * 60_000),
      },
    });

    await prisma.payment.create({
      data: {
        transactionId: txn.id,
        amount: total,
        paymentReference: `PAY-SEED-${i}`,
        status: "SUCCESS",
        createdAt,
      },
    });

    await prisma.settlement.create({
      data: {
        transactionId: txn.id,
        consumerId: buyer.id,
        discomReference: `SET-SEED-${i}`,
        requestedKwh: qty,
        settledKwh: qty,
        billAdjustment: qty.times(5),
        status: "SETTLED",
        settledAt: new Date(createdAt.getTime() + 10 * 60_000),
      },
    });
  }

  // A couple of notifications so the bell has something in it on a fresh demo —
  // the Notification table was previously never written to by anything at all.
  console.log("Creating seller notifications...");
  await prisma.notification.createMany({
    data: [
      {
        userId: prosumer1.id,
        type: "PAYMENT_RECEIVED",
        title: "You've been paid",
        message: "Payment received for your credits — ₹228.00 net of fees.",
        isRead: false,
        createdAt: new Date(now.getTime() - 40 * 60_000),
      },
      {
        userId: prosumer1.id,
        type: "SETTLEMENT_COMPLETE",
        title: "Trade settled with the DISCOM",
        message: "60.00 EC settled against the grid.",
        isRead: true,
        createdAt: new Date(now.getTime() - 90 * 60_000),
      },
      {
        userId: prosumer2.id,
        type: "PAYMENT_RECEIVED",
        title: "You've been paid",
        message: "Payment received for your credits — ₹114.00 net of fees.",
        isRead: false,
        createdAt: new Date(now.getTime() - 25 * 60_000),
      },
    ],
  });

  console.log("Seed complete.");
}
