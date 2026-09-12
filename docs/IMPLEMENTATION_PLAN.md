# Implementation Plan — P2P Renewable Energy Credit Marketplace

**Project:** hackout'26 · **Codename:** `wattshare` (rename freely)
**Assumed constraints:** 36-hour hackathon, team of 4, judged on a live end-to-end demo.
**Non-negotiable demo goal:** verified surplus → EC minted → listed → matched → priced → grid-checked → paid → on-chain transfer → DISCOM settlement → bill adjusted → EC retired.

---

## 0. Assumptions (change these first if wrong)

| # | Assumption | Impact if wrong |
|---|---|---|
| A1 | 36h available, 4 devs (1 BE-core, 1 BE-engines, 1 FE, 1 FE+chain/demo) | Re-slice §3 timeline |
| A2 | Judges care about the *complete lifecycle*, not depth of any one part | Would change cut-list §11 |
| A3 | Blockchain is a credibility feature, not the core — Polygon Amoy testnet, single backend custodial wallet, no MetaMask flow for users | Simplifies §8 massively |
| A4 | Payments are mocked; no real money | §7.6 |
| A5 | Time granularity for meter data = 15-min intervals, simulated | §5.2 |

---

## 1. Architecture decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| Repo | Monorepo, npm workspaces: `apps/api`, `apps/web`, `packages/contracts`, `packages/shared` | One `npm i`, shared TS types |
| Backend shape | **Modular monolith** — `modules/<domain>/{controller,service,routes,validator}.ts` | Faster than the flat folder layout in `backend.md`; same boundaries, service-extractable later |
| DB | Postgres (Neon free tier) + Prisma | Per `database.md` |
| Money/energy types | `Decimal(18,4)` in Prisma, `decimal.js` in TS. **Never `number` for kWh or ₹** | Financial correctness is a judging talking point |
| Credit model | **Credit = a batch with a balance**, not one row per kWh | 150 EC = 1 row with `quantityKwh=150`, `availableKwh`, `reservedKwh`, `retiredKwh`. Avoids 150-row inserts |
| Concurrency | Postgres `SELECT … FOR UPDATE` inside `prisma.$transaction` on credit + listing rows | Kills double-spend (demo Case 6) |
| Chain writes | **Async, fire-and-forget with retry.** Trade completes off-chain; `blockchainTxHash` fills in later, UI shows "Confirming…" | Testnet latency must never block the demo |
| Auth | JWT access token only (no refresh), 7d expiry, bcrypt | Hackathon scope |
| Real-time | Socket.IO, rooms per `gridZoneId` + per `userId` | Targeted emits |
| Time | UTC everywhere in DB/API; format in UI only | Edge case §15 of edge-case doc |

### 1.1 Monorepo layout

```text
p2p-energy/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── config/            env.ts, prisma.ts, constants.ts
│   │   │   ├── modules/
│   │   │   │   ├── auth/          controller, service, routes, validator
│   │   │   │   ├── users/
│   │   │   │   ├── meters/        + simulator.ts
│   │   │   │   ├── credits/       credit-engine.service.ts
│   │   │   │   ├── marketplace/
│   │   │   │   ├── matching/      matching-engine.service.ts
│   │   │   │   ├── pricing/       pricing-engine.service.ts
│   │   │   │   ├── grid/
│   │   │   │   ├── transactions/  state-machine.ts
│   │   │   │   ├── payments/
│   │   │   │   ├── settlement/
│   │   │   │   ├── analytics/
│   │   │   │   └── notifications/
│   │   │   ├── adapters/
│   │   │   │   ├── utility/       UtilityAdapter.ts, MockUtilityAdapter.ts, index.ts
│   │   │   │   └── chain/         chain.service.ts, abi.json, queue.ts
│   │   │   ├── middleware/        auth, rbac, validate, error, rateLimit, idempotency
│   │   │   ├── jobs/              scheduler.ts (node-cron)
│   │   │   ├── sockets/           io.ts, events.ts
│   │   │   ├── lib/               logger.ts, ApiError.ts, respond.ts, decimal.ts
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   ├── prisma/                schema.prisma, seed.ts
│   │   └── tests/
│   ├── web/
│   │   └── src/
│   │       ├── components/ui/     shadcn
│   │       ├── components/charts/ recharts wrappers
│   │       ├── features/          auth, prosumer, consumer, utility, admin, marketplace
│   │       ├── hooks/             useAuth, useSocket, useApi
│   │       ├── lib/               api.ts (axios+interceptor), socket.ts, format.ts
│   │       ├── routes.tsx
│   │       └── main.tsx
├── packages/
│   ├── contracts/                 Hardhat: EnergyCredit.sol, deploy.ts, test
│   └── shared/                    types.ts, enums.ts, zod schemas shared FE/BE
└── docker-compose.yml             postgres for local dev
```

---

## 2. Data model — Prisma schema (paste-ready)

```prisma
// apps/api/prisma/schema.prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role        { PROSUMER CONSUMER UTILITY REGULATOR ADMIN }
enum UserStatus  { ACTIVE SUSPENDED DELETED }
enum MeterType   { SOLAR CONSUMER BIDIRECTIONAL }
enum MeterStatus { ACTIVE OFFLINE SUSPENDED FLAGGED }
enum ZoneStatus  { NORMAL CONGESTED OUTAGE }
enum Congestion  { LOW MEDIUM HIGH }
enum CreditStatus  { VERIFIED MINTED AVAILABLE LISTED RESERVED PURCHASED SETTLED RETIRED EXPIRED FROZEN }
enum ListingStatus { ACTIVE PARTIAL RESERVED SOLD CANCELLED EXPIRED }
enum MatchStatus   { MATCHED RESERVED COMPLETED CANCELLED }
enum TxStatus {
  PENDING MATCHED RESERVED PAYMENT_PENDING PAID CREDIT_TRANSFERRED
  SETTLEMENT_PENDING SETTLED COMPLETED
  PAYMENT_FAILED BLOCKCHAIN_PENDING BLOCKCHAIN_FAILED SETTLEMENT_FAILED CANCELLED EXPIRED
}
enum PayStatus     { PENDING SUCCESS FAILED REFUNDED }
enum SettleStatus  { PENDING SUBMITTED SETTLED PARTIAL FAILED MISMATCH }
enum ReadingStatus { PENDING VERIFIED FLAGGED REJECTED }

model User {
  id           String     @id @default(uuid())
  name         String
  email        String     @unique
  phone        String?
  passwordHash String
  role         Role
  status       UserStatus @default(ACTIVE)
  displayAlias String     @unique          // "Solar-Pro-102" — privacy in listings
  walletAddress String?                     // custodial-derived, optional
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  meters        Meter[]
  credits       EnergyCredit[]       @relation("CreditOwner")
  listings      MarketplaceListing[]
  buyerTxns     Transaction[]        @relation("Buyer")
  sellerTxns    Transaction[]        @relation("Seller")
  notifications Notification[]
  auditLogs     AuditLog[]
}

model GridZone {
  id            String     @id @default(uuid())
  zoneCode      String     @unique          // GZ-AHM-W
  name          String
  capacityKw    Decimal    @db.Decimal(18,4)
  currentLoadKw Decimal    @db.Decimal(18,4) @default(0)
  basePrice     Decimal    @db.Decimal(18,4) @default(4.00)  // ₹/kWh utility reference
  priceFloor    Decimal    @db.Decimal(18,4) @default(2.50)
  priceCeiling  Decimal    @db.Decimal(18,4) @default(7.00)
  lossFactor    Decimal    @db.Decimal(6,4)  @default(0.87)  // DISCOM-provided
  status        ZoneStatus @default(NORMAL)
  neighbourCodes String[]  @default([])       // eligible cross-zone trading
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  meters   Meter[]
  statuses GridStatus[]
  prices   EnergyPrice[]
  listings MarketplaceListing[]
}

model Meter {
  id          String      @id @default(uuid())
  meterNumber String      @unique
  userId      String
  gridZoneId  String
  meterType   MeterType
  status      MeterStatus @default(ACTIVE)
  installedAt DateTime    @default(now())
  createdAt   DateTime    @default(now())

  user     User          @relation(fields: [userId], references: [id])
  gridZone GridZone      @relation(fields: [gridZoneId], references: [id])
  readings MeterReading[]
  credits  EnergyCredit[]

  @@index([userId]) @@index([gridZoneId])
}

model MeterReading {
  id             String        @id @default(uuid())
  meterId        String
  externalId     String                       // utility's reading id, for idempotency
  timestamp      DateTime
  generationKwh  Decimal       @db.Decimal(18,4)
  consumptionKwh Decimal       @db.Decimal(18,4)
  importKwh      Decimal       @db.Decimal(18,4) @default(0)
  exportKwh      Decimal       @db.Decimal(18,4) @default(0)
  surplusKwh     Decimal       @db.Decimal(18,4) @default(0)
  status         ReadingStatus @default(PENDING)
  flagReason     String?
  creditIssued   Boolean       @default(false)  // hard stop on double-minting
  payloadHash    String                          // sha256 of normalised payload
  createdAt      DateTime      @default(now())

  meter   Meter          @relation(fields: [meterId], references: [id])
  credits EnergyCredit[]

  @@unique([meterId, externalId])            // replay / duplicate protection
  @@unique([meterId, timestamp])             // one reading per interval
  @@index([meterId, timestamp])
}

model EnergyCredit {
  id             String       @id @default(uuid())
  creditId       String       @unique        // EC-GZ01-20260912-0007
  ownerId        String
  sourceMeterId  String
  readingId      String       @unique        // 1 reading -> at most 1 credit batch
  quantityKwh    Decimal      @db.Decimal(18,4)
  availableKwh   Decimal      @db.Decimal(18,4)
  reservedKwh    Decimal      @db.Decimal(18,4) @default(0)
  soldKwh        Decimal      @db.Decimal(18,4) @default(0)
  retiredKwh     Decimal      @db.Decimal(18,4) @default(0)
  status         CreditStatus @default(AVAILABLE)
  gridZoneId     String
  generatedAt    DateTime
  expiresAt      DateTime
  blockchainTxHash String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  owner   User         @relation("CreditOwner", fields: [ownerId], references: [id])
  meter   Meter        @relation(fields: [sourceMeterId], references: [id])
  reading MeterReading @relation(fields: [readingId], references: [id])
  listings MarketplaceListing[]

  @@index([ownerId, status]) @@index([gridZoneId, status])
}

model MarketplaceListing {
  id            String        @id @default(uuid())
  sellerId      String
  creditId      String
  gridZoneId    String
  quantityKwh   Decimal       @db.Decimal(18,4)
  remainingKwh  Decimal       @db.Decimal(18,4)
  pricePerKwh   Decimal       @db.Decimal(18,4)
  status        ListingStatus @default(ACTIVE)
  createdAt     DateTime      @default(now())
  expiresAt     DateTime

  seller  User         @relation(fields: [sellerId], references: [id])
  credit  EnergyCredit @relation(fields: [creditId], references: [id])
  zone    GridZone     @relation(fields: [gridZoneId], references: [id])
  matches EnergyMatch[]

  @@index([status, gridZoneId, pricePerKwh])
}

model EnergyMatch {
  id            String      @id @default(uuid())
  transactionId String?
  buyerId       String
  sellerId      String
  listingId     String
  quantityKwh   Decimal     @db.Decimal(18,4)
  pricePerKwh   Decimal     @db.Decimal(18,4)
  score         Decimal     @db.Decimal(6,4)
  gridZoneId    String
  status        MatchStatus @default(MATCHED)
  createdAt     DateTime    @default(now())

  listing     MarketplaceListing @relation(fields: [listingId], references: [id])
  transaction Transaction?       @relation(fields: [transactionId], references: [id])
}

model Transaction {
  id             String   @id @default(uuid())
  transactionId  String   @unique            // TXN-20260912-0042
  idempotencyKey String?  @unique
  buyerId        String
  sellerId       String?                      // null for multi-seller basket
  quantityKwh    Decimal  @db.Decimal(18,4)
  pricePerKwh    Decimal  @db.Decimal(18,4)   // weighted average
  totalAmount    Decimal  @db.Decimal(18,4)
  platformFee    Decimal  @db.Decimal(18,4)
  sellerPayout   Decimal  @db.Decimal(18,4)
  status         TxStatus @default(PENDING)
  gridZoneId     String
  blockchainTxHash String?
  chainAttempts  Int      @default(0)
  failureReason  String?
  createdAt      DateTime @default(now())
  completedAt    DateTime?

  buyer      User         @relation("Buyer",  fields: [buyerId],  references: [id])
  seller     User?        @relation("Seller", fields: [sellerId], references: [id])
  matches    EnergyMatch[]
  payment    Payment?
  settlement Settlement?

  @@index([buyerId]) @@index([status])
}

model Payment {
  id               String    @id @default(uuid())
  transactionId    String    @unique
  amount           Decimal   @db.Decimal(18,4)
  paymentReference String    @unique
  status           PayStatus @default(PENDING)
  paymentMethod    String    @default("MOCK")
  createdAt        DateTime  @default(now())
  transaction      Transaction @relation(fields: [transactionId], references: [id])
}

model Settlement {
  id               String       @id @default(uuid())
  transactionId    String       @unique
  consumerId       String
  discomReference  String?
  requestedKwh     Decimal      @db.Decimal(18,4)
  settledKwh       Decimal      @db.Decimal(18,4) @default(0)
  billAdjustment   Decimal      @db.Decimal(18,4) @default(0)
  status           SettleStatus @default(PENDING)
  attempts         Int          @default(0)
  failureReason    String?
  createdAt        DateTime     @default(now())
  settledAt        DateTime?
  transaction      Transaction  @relation(fields: [transactionId], references: [id])
}

model GridStatus {
  id                 String     @id @default(uuid())
  gridZoneId         String
  loadKw             Decimal    @db.Decimal(18,4)
  generationKw       Decimal    @db.Decimal(18,4)
  availableCapacityKw Decimal   @db.Decimal(18,4)
  congestionLevel    Congestion
  timestamp          DateTime   @default(now())
  zone GridZone @relation(fields: [gridZoneId], references: [id])
  @@index([gridZoneId, timestamp])
}

model EnergyPrice {
  id               String   @id @default(uuid())
  gridZoneId       String
  basePrice        Decimal  @db.Decimal(18,4)
  demandFactor     Decimal  @db.Decimal(8,4)
  supplyFactor     Decimal  @db.Decimal(8,4)
  congestionFactor Decimal  @db.Decimal(8,4)
  finalPrice       Decimal  @db.Decimal(18,4)
  timestamp        DateTime @default(now())
  zone GridZone @relation(fields: [gridZoneId], references: [id])
  @@index([gridZoneId, timestamp])
}

model Notification {
  id        String   @id @default(uuid())
  userId    String
  type      String
  title     String
  message   String
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())
  user User @relation(fields: [userId], references: [id])
  @@index([userId, isRead])
}

model AuditLog {
  id         String   @id @default(uuid())
  userId     String?
  action     String
  entityType String
  entityId   String
  metadata   Json?
  timestamp  DateTime @default(now())
  user User? @relation(fields: [userId], references: [id])
  @@index([entityType, entityId])
}
```

**Schema deltas vs `database.md` (deliberate):**
`EnergyCredit` carries a balance (available/reserved/sold/retired) instead of one row per kWh; `readingId` is `@unique` so double-minting is a DB constraint, not app logic; `MeterReading` has `externalId`+`payloadHash` for replay protection; `MarketplaceListing.remainingKwh` enables partial fills; `Transaction.idempotencyKey` is `@unique`; `GridZone` holds `basePrice`, `lossFactor`, `priceFloor/Ceiling`, `neighbourCodes` so pricing and eligibility are config, not code.

---

## 3. Timeline — 36 hours

Roles: **B1** backend core · **B2** backend engines · **F1** frontend core · **F2** frontend + chain + demo.

| Block | Hours | B1 | B2 | F1 | F2 |
|---|---|---|---|---|---|
| **H0 Setup** | 0–2 | Monorepo, Prisma schema, Neon DB, `migrate dev`, seed skeleton | Zone/price constants, `decimal.ts`, `calculations.ts` | Vite+TS+Tailwind+shadcn, router, layout shells | Hardhat init, `EnergyCredit.sol` skeleton, Amoy RPC key |
| **H1 Spine** | 2–7 | Auth (register/login/me), JWT, RBAC, error+respond, Zod middleware | Meter CRUD, reading ingest + validation + surplus calc | Login/register, auth store, protected routes, API client | Contract compile + deploy to Amoy, `chain.service.ts` mint/transfer/retire |
| **H2 Credits** | 7–12 | Users/dashboard aggregates, audit log, notifications table | **Credit Engine**: mint, balance ops, expiry. Meter **simulator** job | Prosumer dashboard: gen/consumption/surplus charts, credit list | Seed script: 2 zones, 4 prosumers, 3 consumers, utility, admin, 48h of readings |
| **H3 Market** | 12–18 | Listing create/cancel/list w/ filters, row-locking helpers | **Pricing Engine** + cron; **Grid** service + congestion | Marketplace UI, filters, listing cards, sell modal | Socket.IO client hook, live price ticker |
| **H4 Trade** | 18–24 | **Transaction service** + state machine + idempotency, atomic reserve | **Matching Engine** (scored, multi-seller, partial) | Consumer flow: request energy → match preview → confirm → status page | Chain queue worker + retry, tx hash surfacing in UI |
| **H5 Settle** | 24–29 | Payment (mock), refund/release path | `MockUtilityAdapter`, Settlement service + polling job, retire credits | Utility + Admin/Regulator dashboards | Bill-adjustment "before/after" component |
| **H6 Polish** | 29–33 | Analytics endpoints, seed reset endpoint `/api/v1/demo/reset` | Edge-case triggers endpoint (`/demo/congest`, `/demo/discom-down`) | Empty states, toasts, loading skeletons, responsive pass | Deploy FE (Vercel) + BE (Render) + DB, smoke test |
| **H7 Demo** | 33–36 | — | — | — | **All:** rehearse §12 script 3×, freeze code, record 2-min backup video |

**Hard gates** (if a gate slips, cut from §11 immediately):
- **G1 @ H12** — a prosumer can log in and see credits minted from simulated readings.
- **G2 @ H18** — a listing appears in the marketplace with a live dynamic price.
- **G3 @ H24** — a purchase completes through `PAID` with credits atomically reserved.
- **G4 @ H29** — full lifecycle to `COMPLETED` + bill adjustment renders.

---

## 4. Build order (dependency-correct)

```text
prisma schema → seed → auth → meters+readings → CREDIT ENGINE
        → listings → PRICING → GRID → MATCHING → TRANSACTIONS
        → payments → settlement(mock DISCOM) → retire → analytics
        → sockets → chain(async) → dashboards → demo controls
```
Chain and sockets are **last-layer decorations** — nothing in the core path may await them.

---

## 5. Module specs

### 5.1 Credit Engine (`credits/credit-engine.service.ts`)

```text
mintFromReading(readingId):
  tx = db.transaction:
    reading = SELECT ... FOR UPDATE where id=readingId
    guard reading.status == VERIFIED          else ERR READING_NOT_VERIFIED
    guard reading.creditIssued == false       else ERR CREDITS_ALREADY_ISSUED
    gross  = max(0, generationKwh - consumptionKwh)
    guard gross > 0                           else return null (no credits)
    zone   = reading.meter.gridZone
    eligible = round(gross * zone.lossFactor, 4)
    credit = create EnergyCredit {
      creditId: EC-<zoneCode>-<yyyymmdd>-<seq>
      quantityKwh: eligible, availableKwh: eligible,
      status: AVAILABLE, generatedAt: reading.timestamp,
      expiresAt: reading.timestamp + CREDIT_VALIDITY_HOURS (default 72)
    }
    reading.creditIssued = true
    audit(CREDIT_CREATED)
  enqueueChain({op:'mint', creditId, qty: eligible, owner: sellerWallet})
  emit socket 'credit:minted' -> user room
  return credit
```

Invariants enforced in code **and** DB:
- `available + reserved + sold + retired == quantityKwh` (assert before commit)
- `available >= 0`, `reserved >= 0`
- one credit batch per reading (`readingId @unique`)

**Reading validation** (before `VERIFIED`), from edge-case doc §2–3:
```text
reject if generationKwh < 0 or consumptionKwh < 0
reject if timestamp > now + 5min  (clock skew)
flag   if generationKwh > meter.ratedKw * intervalHours * 1.2   → status=FLAGGED
flag   if generationKwh > 3 × trailing 7-interval median        → status=FLAGGED
dedupe on (meterId, externalId) and payloadHash                 → 200 idempotent no-op
reject if meter.status != ACTIVE                                → METER_NOT_ACTIVE
else VERIFIED
```

### 5.2 Meter Simulator (`meters/simulator.ts`, cron every 30s = 1 simulated 15-min interval)

```text
for each SOLAR/BIDIRECTIONAL meter:
  hour   = simulatedClock.hour
  solarK = bellCurve(hour, peak=13, width=3.2)         // 0..1
  gen    = meter.ratedKw * solarK * jitter(0.9..1.1) * 0.25h
  cons   = profile[meter.userId][hour] * jitter(0.85..1.15) * 0.25h
  POST internally -> meters.ingestReading()
  -> auto-verify -> auto-mint -> socket 'energy:update'
```
Simulated clock runs **60× real time** so a demo minute = an hour of solar. Expose `POST /api/v1/demo/clock { hour }` to jump to peak-solar for the pitch.

### 5.3 Pricing Engine (`pricing/pricing-engine.service.ts`, cron every 20s per zone)

```text
supplyKwh = Σ remainingKwh of ACTIVE listings in zone
demandKwh = Σ open demand (buyer requests last 15 min) + rolling consumption forecast
ratio     = demandKwh / max(supplyKwh, ε)

demandFactor     = clamp(0.35 * (ratio - 1),           -0.30, +0.40)
supplyFactor     = clamp(0.25 * (supplyKwh/demandKwh - 1), 0,  +0.25)   // subtracted
utilisation      = currentLoadKw / capacityKw
congestionFactor = utilisation <= 0.70 ? 0
                 : utilisation <= 0.90 ? 0.10
                 : 0.25

final = base * (1 + demandFactor - supplyFactor + congestionFactor)
final = clamp(final, zone.priceFloor, zone.priceCeiling)   // anti-manipulation
persist EnergyPrice; emit 'price:update' to zone room
```
Listing price validation: reject `pricePerKwh` outside `[floor, ceiling]` → `PRICE_OUT_OF_BAND` (demo edge case §6.5).

### 5.4 Grid service (`grid/`)

```text
availableCapacityKw = capacityKw - currentLoadKw
congestion = avail/capacity > 0.30 ? LOW : > 0.10 ? MEDIUM : HIGH

canTrade(zoneId, kwh):
  if zone.status == OUTAGE      -> { ok:false, reason:'ZONE_OUTAGE' }
  if kwh > availableCapacityKw  -> { ok:false, reason:'GRID_CONGESTED',
                                     maxAllowedKwh: availableCapacityKw }
  else                          -> { ok:true }
```
On `GRID_CONGESTED` the transaction API returns 409 with `maxAllowedKwh`; the UI offers **"Buy N EC instead"** — a strong demo beat.

### 5.5 Matching Engine (`matching/matching-engine.service.ts`)

```text
findMatches({buyerId, quantityKwh, gridZoneId, maxPrice}):
  candidates = ACTIVE listings where
      remainingKwh > 0
      and credit.expiresAt > now
      and pricePerKwh <= maxPrice (if given)
      and (listing.gridZoneId == buyerZone OR listing.zoneCode ∈ buyerZone.neighbourCodes)
      and sellerId != buyerId
      and listing.zone.status != OUTAGE

  for each c:
    priceScore  = 1 - (c.price - minPrice) / max(maxPrice - minPrice, ε)
    gridScore   = c.gridZoneId == buyerZone ? 1.0 : 0.6
    availScore  = min(c.remainingKwh / quantityKwh, 1)
    condScore   = {LOW:1.0, MEDIUM:0.6, HIGH:0.2}[c.zone.congestion]
    score = 0.40*priceScore + 0.25*gridScore + 0.20*availScore + 0.15*condScore

  sort desc by score, then asc by price
  greedily fill until quantity met  → allocations[{listingId, kwh, price, score}]
  unfilledKwh = quantity - Σ allocated        // returned, not an error
  return { allocations, filledKwh, unfilledKwh, weightedAvgPrice }
```
`unfilledKwh > 0` drives edge case **Case 4**: UI shows *"350 EC from P2P · 150 kWh from normal grid supply."*

### 5.6 Transaction service — the atomic core

```text
createTransaction({buyerId, allocations, idempotencyKey}):
  if idempotencyKey seen -> return stored transaction (200)

  db.$transaction(isolation: Serializable):           // ~8s timeout
    total = Σ alloc.kwh
    grid  = gridService.canTrade(buyerZone, total)
    if !grid.ok -> throw ApiError(409, grid.reason, {maxAllowedKwh})

    for each alloc:
      listing = SELECT ... FOR UPDATE                 // row lock
      credit  = SELECT ... FOR UPDATE
      guard listing.status ∈ {ACTIVE, PARTIAL}
      guard listing.remainingKwh >= alloc.kwh  else throw INSUFFICIENT_CREDITS
      guard credit.availableKwh  >= alloc.kwh  else throw INSUFFICIENT_CREDITS
      guard credit.expiresAt > now             else throw CREDIT_EXPIRED

      credit.availableKwh -= alloc.kwh
      credit.reservedKwh  += alloc.kwh
      credit.status = credit.availableKwh == 0 ? RESERVED : LISTED
      listing.remainingKwh -= alloc.kwh
      listing.status = listing.remainingKwh == 0 ? RESERVED : PARTIAL
      create EnergyMatch{status: RESERVED}

    fee     = round(total * avgPrice * PLATFORM_FEE_RATE, 4)   // 0.10 = ₹0.50/EC at ₹5
    txn = create Transaction{ status: RESERVED, totalAmount, platformFee, sellerPayout }
    link matches -> txn
    audit(TRADE_MATCHED)

  emit 'trade:matched'; schedule reservation expiry job (+5 min)
```

**State machine** (`transactions/state-machine.ts`) — a single `assertTransition(from, to)` guard, illegal jumps throw:
```text
PENDING → MATCHED → RESERVED → PAYMENT_PENDING → PAID
  → CREDIT_TRANSFERRED → SETTLEMENT_PENDING → SETTLED → COMPLETED
RESERVED|PAYMENT_PENDING → PAYMENT_FAILED|CANCELLED|EXPIRED  → release reservation
PAID → BLOCKCHAIN_PENDING → (retry) → CREDIT_TRANSFERRED | BLOCKCHAIN_FAILED
SETTLEMENT_PENDING → SETTLEMENT_FAILED → (retry) → SETTLED
```

`releaseReservation(txnId)`: reverse the reserve math, restore listing to ACTIVE/PARTIAL, mark matches CANCELLED, audit. Called by payment failure, buyer cancel, and the 5-minute expiry job.

### 5.7 Payment (mock)
`POST /payments` with `Idempotency-Key` header → 1.2s simulated latency → `SUCCESS` (or `FAILED` when `simulateFailure:true`, for the demo) → on success advance to `PAID`, move `reserved → sold` on credits, enqueue chain transfer, create `Settlement{PENDING}`.

### 5.8 Settlement + MockUtilityAdapter

```typescript
export interface UtilityAdapter {
  getMeterData(meterId: string): Promise<MeterSnapshot>;
  getGridStatus(zoneId: string): Promise<GridSnapshot>;
  getTariff(zoneId: string): Promise<Tariff>;
  getSettlementRules(zoneId: string): Promise<SettlementRules>;
  submitSettlement(req: SettlementRequest): Promise<SettlementAck>;
  getSettlementStatus(ref: string): Promise<SettlementResult>;
}
```
`MockUtilityAdapter` behaviour (deterministic, demo-controllable):
- `submitSettlement` → `{ reference: 'SET-<n>', status: 'ACCEPTED' }` after 800ms
- Poll job (every 10s) → `SETTLED` with `settledKwh = requestedKwh`, `billAdjustment = settledKwh × tariff`
- Flags via `/api/v1/demo/discom { mode }`: `ok` | `down` (503 → status stays `PENDING`, retried) | `partial` (settles 80%, status `PARTIAL`) | `mismatch` (95 kWh vs 100 → status `MISMATCH`, flagged for regulator)
- **Credits are only `RETIRED` for the settled portion** — never on submit.

---

## 6. API surface (`/api/v1`)

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/auth/register` | — | Zod; bcrypt 10 rounds |
| POST | `/auth/login` | — | rate-limited 5/min |
| GET | `/auth/me` | any | |
| GET | `/users/dashboard` | any | role-shaped payload |
| POST | `/meters` | PROSUMER/CONSUMER | |
| GET | `/meters/:id/readings` | owner/UTILITY | paginated |
| POST | `/meters/:id/readings` | UTILITY/system | idempotent on `externalId` |
| GET | `/credits` | owner | filter `status` |
| GET | `/credits/:id` | owner/REGULATOR | includes chain hash |
| POST | `/credits/generate` | system/PROSUMER | `{readingId}` |
| POST | `/marketplace/listings` | PROSUMER | price-band validated |
| GET | `/marketplace/listings` | CONSUMER+ | `?zone&minPrice&maxPrice&minQty&sort` — **never returns seller PII, only `displayAlias` + zone name** |
| DELETE | `/marketplace/listings/:id` | owner | releases credits |
| POST | `/matching/find` | CONSUMER | returns allocations + `unfilledKwh` |
| POST | `/transactions` | CONSUMER | `Idempotency-Key` required |
| GET | `/transactions` `/transactions/:id` | party/REGULATOR | |
| POST | `/transactions/:id/cancel` | buyer | pre-payment only |
| POST | `/payments` | CONSUMER | `Idempotency-Key` |
| POST | `/settlements` | system/UTILITY | |
| GET | `/settlements/:id` | party/UTILITY | |
| GET | `/grid/zones` `/grid/zones/:id/status` | any | |
| GET | `/pricing/current?zone=` `/pricing/history?zone=&hours=` | any | |
| GET | `/analytics/market` `/analytics/me` | role-scoped | |
| GET | `/notifications` · PATCH `/notifications/:id/read` | owner | |
| GET | `/audit` | REGULATOR/ADMIN | |
| POST | `/demo/reset` `/demo/clock` `/demo/congest` `/demo/discom` | ADMIN | **demo control panel** |

Response envelope (always):
```json
{ "success": true, "data": {}, "meta": {} }
{ "success": false, "message": "Human readable", "errorCode": "INSUFFICIENT_CREDITS" }
```

**Error codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `READING_NOT_VERIFIED`, `CREDITS_ALREADY_ISSUED`, `INSUFFICIENT_CREDITS`, `CREDIT_EXPIRED`, `PRICE_OUT_OF_BAND`, `GRID_CONGESTED`, `ZONE_OUTAGE`, `ZONE_NOT_ELIGIBLE`, `PAYMENT_FAILED`, `SETTLEMENT_FAILED`, `DUPLICATE_REQUEST`, `METER_NOT_ACTIVE`, `RATE_LIMITED`.

### Socket.IO events
`price:update` · `marketplace:update` · `grid:update` · `energy:update` · `credit:minted` · `trade:matched` · `payment:updated` · `settlement:updated` · `notification:new`
Rooms: `zone:<zoneId>` (market/price/grid), `user:<userId>` (personal).

---

## 7. Frontend plan

| Route | Role | Key content |
|---|---|---|
| `/login` `/register` | — | role picker |
| `/prosumer` | PROSUMER | live gen-vs-consumption area chart, surplus tile, EC balance, earnings, price ticker |
| `/prosumer/credits` | | credit batch table: status pills, expiry countdown, chain hash link |
| `/prosumer/sell` | | list modal: qty slider, price input with **live band hint + suggested market price** |
| `/consumer` | CONSUMER | requirement tile, purchased EC, savings-vs-grid tile, bill adjustment card |
| `/consumer/marketplace` | | listing grid, filters, "Auto-match my requirement" CTA |
| `/consumer/checkout` | | **match preview**: allocation table (3 sellers), weighted avg price, grid check badge, unfilled-kWh notice, confirm |
| `/consumer/transactions/:id` | | **lifecycle stepper** (11 states) updating live — the single most persuasive screen |
| `/utility` | UTILITY | zone cards (load/capacity gauge), total P2P traded, settlement queue, congestion alerts |
| `/admin` | REGULATOR/ADMIN | txn volume, price trend, flagged readings, settlement mismatches, audit table, **demo control panel** |

FE conventions: TanStack Query for fetch/cache; one `useSocket` hook invalidating query keys on events; `Decimal` values as strings from API, formatted via `format.ts` (`₹` INR, `kWh`, `EC`); dark theme, energy-green→amber palette; every list has a real empty state.

**Demo control panel** (admin, top-right drawer): buttons for `Reset data`, `Jump to 13:00`, `Congest GZ-01`, `DISCOM down`, `DISCOM partial`, `Force payment failure`. Lets you trigger any edge case on stage in one click.

---

## 8. Blockchain (deliberately thin)

`packages/contracts/EnergyCredit.sol`:
```solidity
// Ownable, single authorized backend operator
struct Credit { string creditId; uint256 qtyWh; address owner; uint8 status; uint64 ts; }
mapping(bytes32 => Credit) public credits;   // keccak(creditId) => Credit
event CreditMinted(string creditId, uint256 qtyWh, address owner);
event CreditTransferred(string creditId, address from, address to, uint256 qtyWh);
event CreditRetired(string creditId, uint256 qtyWh, string settlementRef);

function mintCredit(string calldata creditId, uint256 qtyWh, address owner) external onlyOperator;
function transferCredit(string calldata creditId, address to, uint256 qtyWh) external onlyOperator;
function retireCredit(string calldata creditId, uint256 qtyWh, string calldata ref) external onlyOperator;
function getCredit(string calldata creditId) external view returns (Credit memory);
```
Quantities on-chain as **watt-hours (uint)** — no floats. No PII on-chain; users are represented by deterministic pseudo-addresses derived from `userId`.

`adapters/chain/queue.ts`: in-memory FIFO + `setInterval` worker, 3 retries with backoff (2s/8s/30s). Success → write `blockchainTxHash`, emit socket, set `CREDIT_TRANSFERRED`. Exhausted → `BLOCKCHAIN_FAILED`, visible in admin, **transaction still settles** (documented as "chain is the audit trail, not the critical path"). If Amoy is flaky at demo time, `CHAIN_MODE=simulated` returns a plausible hash — flip via env, and say so honestly if asked.

---

## 9. Seed data (`prisma/seed.ts`) — tuned to the demo script

```text
Zones:  GZ-AHM-W  cap 1000 kW, load 620 kW, base ₹4.00, loss 0.87, neighbours [GZ-AHM-E]
        GZ-AHM-E  cap  800 kW, load 300 kW, base ₹4.10, loss 0.88, neighbours [GZ-AHM-W]

Users (password: demo1234):
  prosumer1@demo.in  Solar-Pro-101  GZ-AHM-W  6 kW rooftop   → seeded to ~130 EC
  prosumer2@demo.in  Solar-Pro-102  GZ-AHM-W  12 kW          → seeded to ~400 EC
  prosumer3@demo.in  Solar-Pro-103  GZ-AHM-E  4 kW           → ~90 EC
  prosumer4@demo.in  Solar-Pro-104  GZ-AHM-W  8 kW           → FLAGGED meter (fraud demo)
  consumer1@demo.in  (main demo buyer, GZ-AHM-W)
  consumer2@demo.in  consumer3@demo.in
  utility@demo.in  regulator@demo.in  admin@demo.in

History: 48h of 15-min readings, realistic solar bell curves
Listings: P1 130 EC @ ₹4.20 · P2 400 EC @ ₹4.10 · P3 90 EC @ ₹4.30
Past: 12 completed transactions across 2 days (so charts/analytics aren't empty)
```

---

## 10. Testing & verification

| Layer | What | When |
|---|---|---|
| Unit (vitest) | credit math + loss factor; pricing clamp at floor/ceiling; matching allocation sums to demand; state-machine illegal transitions | as written, H7–H24 |
| Integration | **Double-spend race**: 2 concurrent purchases of the last 100 EC → exactly one succeeds | H24, mandatory |
| Integration | Duplicate `externalId` reading → one credit batch only | H12 |
| Integration | Idempotent payment: same key twice → one `Payment` row | H26 |
| E2E manual | The §12 script, start to finish, on the **deployed** URLs | H30, H33, H35 |
| Invariant check | script asserting `Σ(available+reserved+sold+retired) == quantityKwh` for every credit, and `Σ settledKwh ≤ Σ soldKwh` | run after each rehearsal |

`GET /health` returns DB, chain, and DISCOM-mock status — glance before going on stage.

---

## 11. Cut list (in this order, when behind)

1. Admin/Regulator dashboard → shrink to one audit table
2. Notifications persistence → toasts only
3. Analytics history charts → current-value tiles only
4. Cross-zone neighbour matching → same-zone only
5. Credit expiry job → longer validity, no expiry demo
6. Real Amoy chain → `CHAIN_MODE=simulated` (say so if asked)
7. Deployment → run locally with a tunnel

**Never cut:** atomic reservation/double-spend, surplus→credit verification, the transaction lifecycle stepper, DISCOM bill-adjustment screen. Those four *are* the pitch.

---

## 12. Demo script (7 minutes)

1. **(0:30)** Admin panel → `Reset` + `Jump to 13:00`. Prosumer dashboard: generation curve climbing live, surplus accumulating, "150 kWh surplus → ×0.87 loss factor → **130.5 EC minted**". Point at the credit ID and chain hash.
2. **(1:00)** List 130 EC at ₹4.20. Show the price band hint (₹2.50–₹7.00) and try ₹1000 → **rejected**, `PRICE_OUT_OF_BAND`.
3. **(1:30)** Switch to consumer. Requirement 500 EC → auto-match → allocation table: **P2 400 EC + P1 100 EC**, weighted avg ₹4.12, grid check ✅. Confirm.
4. **(1:00)** Second browser: another consumer tries to buy the same last credits → **`INSUFFICIENT_CREDITS`**. "Same energy can never be sold twice — Postgres row lock, not a UI check."
5. **(1:00)** Pay (mock) → watch the lifecycle stepper advance live: `PAID → CREDIT_TRANSFERRED (tx 0x8a7f…) → SETTLEMENT_PENDING → SETTLED`. Bill card: **₹2,500 → ₹2,080**. Credits `RETIRED`.
6. **(1:00)** Edge cases on demand: `Congest GZ-01` → new trade returns "only 50 kW available, buy 50 EC instead". `DISCOM down` → settlement sits at `PENDING`, retries, recovers. "We never retire a credit before the utility confirms."
7. **(0:30)** Utility + Regulator dashboards: zone load, total P2P traded, renewable utilisation, audit trail. Close on the principle: *the grid stays the grid — we're the verified settlement layer on top.*

---

## 13. Environment

```env
# apps/api/.env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://...neon.tech/p2p?sslmode=require
JWT_SECRET=<32+ random bytes>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173,https://<vercel-app>.vercel.app

PLATFORM_FEE_RATE=0.10
CREDIT_VALIDITY_HOURS=72
RESERVATION_TTL_MINUTES=5
SIM_SPEED_MULTIPLIER=60
SIM_TICK_MS=30000

CHAIN_MODE=live            # live | simulated
BLOCKCHAIN_RPC_URL=https://rpc-amoy.polygon.technology
BLOCKCHAIN_PRIVATE_KEY=<operator key — testnet only, never reuse>
SMART_CONTRACT_ADDRESS=0x...

UTILITY_ADAPTER=mock       # mock | torrent
DISCOM_MODE=ok             # ok | down | partial | mismatch
```
`.env` in `.gitignore` from commit #1. Testnet key only — never a key holding real funds.

---

## 14. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Testnet RPC slow/down mid-demo | High | Async queue + `CHAIN_MODE=simulated` fallback (§8) |
| Neon cold start stalls first request | Med | Warm-up ping in the 60s before demo; `/health` check |
| Serializable txn deadlocks under the double-spend test | Med | Consistent lock ordering by `listingId ASC`; retry once on `P2034` |
| Scope creep into real MetaMask flows | High | A3 is locked — custodial backend wallet only |
| Decimal/float bugs surfacing as ₹0.0000001 | Med | `Decimal` everywhere + the invariant script in §10 |
| Deploy at H33 goes wrong | Med | Deploy a hello-world through the full pipeline at **H2**, not H33 |

---

## 15. Definition of done

- [ ] `npm i && npm run dev` boots API + web from a clean clone
- [ ] `npx prisma migrate deploy && npm run seed` produces the §9 world
- [ ] The §12 script runs start-to-finish on deployed URLs without a code change
- [ ] Double-spend integration test passes
- [ ] Every credit satisfies `available + reserved + sold + retired == quantity`
- [ ] No settled credit exceeds its purchased quantity; no credit retired before `SETTLED`
- [ ] README with architecture diagram, demo logins, and the 5 safety principles
- [ ] 2-minute backup demo video recorded
