# Prosumer / Seller Module — Bug Audit & Fix Plan

**Scope:** the prosumer (seller) half of WattShare — `/prosumer`, `/prosumer/credits`,
`/prosumer/sell`, the shared `AppShell` chrome, and `/marketplace` as seen by a seller —
plus the `credits`, `marketplace`, `meters`, `users`, `transactions` and `analytics` API
modules behind them.

**31 defects found.** Four are blockers, including one that makes selling impossible,
one that misstates the seller's payout by half the fee, one that loses a seller's
earnings entirely, and a cluster of missing ownership checks that lets any logged-in
user read and write another prosumer's meters and credits.

## How this was verified

Static audit first, then a live pass against a running stack: API on `:5000`
(`chainMode: simulated`, `PLATFORM_FEE_RATE=0.10`), web on `:5173`, Neon Postgres,
logged in as `prosumer1@demo.in` (`Solar-Pro-101`). UI findings were confirmed in
Chrome by inspecting React props and computed styles; API findings by direct calls.

Every bug carries one of:

- **CONFIRMED** — reproduced live, with the observed values recorded.
- **CONFIRMED (inspection)** — the code path is unambiguous but the symptom was not
  triggerable in the demo window (needs 72h of elapsed time, many reservations, etc.).

Test artifacts were cleaned up and the database was reseeded afterwards
(`npm run db:seed`), so demo state is clean as of the end of this audit.

Note the audit ran against `PLATFORM_FEE_RATE=0.10`; that value is now `0.05` — see Bug 2.

## Fixes applied so far

**Bugs 1, 6 and 7** were fixed together, since all three are the same mistake: using
`CreditStatus` as a sellability flag when listings are many-to-one against a credit.
Sellability is now derived from quantity (`availableKwh` minus what open listings
already claim), the chain callback no longer stamps `MINTED` over `AVAILABLE`, a partial
listing no longer flips the whole credit to `LISTED`, and cancelling recomputes rather
than assuming the credit is free.

**Bug 2** was fixed by making 5% the true rate across the stack (see that section).

**Bug 4** closed all seven holes with a shared `lib/authorize.ts` (`assertOwns` /
`assertCanRead` / `assertCanReadAny`), so ownership assertion is now a convention
rather than ad-hoc. Non-owners get 404, not 403 — a 403 confirms the id exists.
Oversight roles (UTILITY/REGULATOR/ADMIN) may read but never write.

**Bug 10** is now refused server-side with a new `SELF_TRADE` error code, checked per
allocation so a basket mixing someone else's listing with your own is caught too. The
listing projection gained a derived `isOwn` boolean — not the raw `sellerId`, so seller
identity stays redacted — and the marketplace marks those cards "Your listing" with the
buy button disabled rather than hiding them.

**Bug 11** removed the `.toNumber()` leaks at all four Prisma write sites
(`transactions.service.ts` ×2, `payments.service.ts`, `settlement.service.ts`). The
three remaining `.toNumber()` calls are legitimate — two ratios used for threshold
comparisons, and the simulator feeding a `z.coerce.number()` input contract.
**Bug 31** was the same two lines: a released listing's status is now recomputed from
the restored quantity instead of carried forward.

**Bug 18** added `useApiMutation` beside `useApiQuery`, so a write refreshes whatever
else depends on it instead of only its own screen. Headers may be passed as a function —
an `Idempotency-Key` built once at mount would make every purchase after the first look
like a replay of it. Listing creation, the marketplace buy and listing withdrawal all
run through it.

**Bug 5** added `?mine=true` to the listings query (widening the status filter so a
seller sees SOLD/CANCELLED history, which no endpoint previously exposed) and a
`/prosumer/listings` screen with a two-step withdraw confirmation.

**Bug 13** added `/prosumer/transactions` — a seller-side view showing quantity sold,
fee, net payout and settlement status. Multi-seller baskets are labelled "shared basket"
and show the basket total rather than a per-seller payout that does not exist for them;
cancelled trades are struck through and marked "not earned". The nav item that said
"Txns" but pointed at credit batches now reads "Sales" and points here, with a separate
"Listings" entry.

**Bug 12** added an expiry tick to the scheduler (every 60s) that marks stale credits
and listings `EXPIRED`, plus a `CREDIT_EXPIRED` guard at listing creation so the failure
reaches the seller publishing rather than a buyer at reservation. Credits with
`reservedKwh > 0` are left alone — expiring under an in-flight purchase would strand it.

**Bugs 8 and 9** were fixed together behind one `lib/notify.ts` helper that persists a
notification and pushes it down the user's socket in one step; it never throws, because a
notification is a side-effect of a trade and must not be able to fail one. Sellers are now
notified — and emitted to — at reservation, payment and settlement, derived from
`EnergyMatch` so multi-seller baskets reach every seller exactly once. The bell became a
real menu button (`aria-expanded`, Escape-to-close, focus return) that marks items read
through the previously-unused `PATCH /notifications/:id/read`. `useSocketInvalidate` was
fixed first: it depended on an inline array literal, so it re-subscribed on every render.

**Bugs 3, 25 and 26** were fixed together: seller earnings now come from `EnergyMatch`
via a shared `getSellerTotals`, used by both `/users/dashboard` and `/analytics/me`,
against one `SELLER_EARNED_STATUSES` list thresholded at `PAID`.

Verified live: all three prosumers can list again, the Sell page's advertised ceiling
matches what the server accepts, a batch survives a partial listing with its remainder
still listable, and a simulator-minted credit now appears in the dropdown.

**Test suite:** 27/27 passing (6 suites), up from 13/19 — see the caveat below. Eight new tests lock in the
fixes, including one asserting the balance invariant holds exactly across a
reserve/release cycle on a quantity float64 cannot represent (33.3333). `apps/api` now runs Jest with `--runInBand` — these are integration tests against
one shared database, and parallel workers were failing each other with serialization
errors; three fixture cleanups were also hardened to delete in FK order.

**Known flakiness — not a code defect.** `TEST_DATABASE_URL` is unset, so the integration
tests run against the same database as the dev server, whose scheduler polls settlements
every 10s and ticks the simulator every 30s. Five fixture cleanups have been hardened
against it (deleting in FK order, matching on the row being removed rather than on a
user that may already be gone), but the multi-allocation test still runs ~24s against a
30s timeout on the remote Neon instance and can trip it under load. Over a ~90s full run it can advance a test's
own transaction mid-assertion (`Illegal transaction transition: SETTLEMENT_PENDING ->
PAYMENT_PENDING`) or mint credits onto a fixture meter. Every suite passes reliably in
isolation; roughly one full run in two shows a single spurious failure. The fix is to
point `TEST_DATABASE_URL` at the local Postgres in `docker-compose.yml`, not to change
application code.

Everything else in this document is still open.

---

## Severity summary

| # | Sev | Bug | Location | Status |
|---|---|---|---|---|
| 1 | **P0** | Minted credits vanish from the Sell page — selling is impossible | `credit-engine.service.ts:78` | CONFIRMED — **FIXED** |
| 2 | **P0** | Payout shown at 5%, actually charged 10% | `ProsumerSell.tsx:29` | CONFIRMED — **FIXED** |
| 3 | **P0** | Multi-seller trades record `sellerId: null` — earnings and sales list lose the row | `transactions.service.ts:108` | CONFIRMED — **FIXED** |
| 4 | **P0** | Any user can read/write any prosumer's meters and credits | `meters.controller.ts`, `credits.controller.ts:26` | CONFIRMED — **FIXED** |
| 5 | **P1** | Seller cannot cancel a listing — endpoint exists, no UI | `marketplace.routes.ts:13` | CONFIRMED — **FIXED** |
| 6 | **P1** | Partially-listed credit becomes unlistable | `marketplace.service.ts:36` | CONFIRMED — **FIXED** |
| 7 | **P1** | Cancelling one listing frees a credit still held by another | `marketplace.service.ts:69` | CONFIRMED — **FIXED** |
| 8 | **P1** | Seller is never notified of anything — sale, payment, settlement | all `emitToUser` sites | CONFIRMED — **FIXED** |
| 9 | **P1** | Notification bell is a dead button; `Notification` table never written | `AppShell.tsx:85` | CONFIRMED — **FIXED** |
| 10 | **P1** | Prosumers can buy their own listings | `Marketplace.tsx:123` | CONFIRMED — **FIXED** |
| 11 | **P1** | `reservedKwh` written as a JS float — breaks the balance invariant | `transactions.service.ts:126` | CONFIRMED — **FIXED** |
| 12 | **P1** | Expired credits still listable; no expiry job | `scheduler.ts` | CONFIRMED — **FIXED** |
| 13 | **P1** | No prosumer sales screen; nav "Txns" points at credits | `AppShell.tsx:31` | CONFIRMED — **FIXED** |
| 14 | **P2** | `useAuth` is per-component state, not shared | `useAuth.ts:8` | CONFIRMED (inspection) |
| 15 | **P2** | Socket auth token captured once, never refreshed | `socket.ts:8` | CONFIRMED (inspection) |
| 16 | **P2** | Dashboard "Avail to Sell" contradicts the Sell page | `users.service.ts:13` | CONFIRMED |
| 17 | **P2** | `MarketplaceListingDTO` doesn't match the API response | `types.ts:102` | CONFIRMED — **FIXED** |
| 18 | **P2** | Publishing a listing leaves dashboard/header balances stale | `ProsumerSell.tsx:44` | CONFIRMED — **FIXED** |
| 19 | **P2** | Zone price band displayed but never enforced client-side | `ProsumerSell.tsx:136` | CONFIRMED |
| 20 | **P2** | Quantity `max` not enforced before POST | `ProsumerSell.tsx:104` | CONFIRMED |
| 21 | **P2** | Sell form isn't a `<form>` — Enter key dead | `ProsumerSell.tsx:59` | CONFIRMED |
| 22 | **P2** | Success and error render identically | `ProsumerSell.tsx:159` | CONFIRMED |
| 23 | **P2** | `ProsumerCredits` has zero interactive elements, no loading/error state | `ProsumerCredits.tsx` | CONFIRMED |
| 24 | **P3** | 401 clears token but leaves `user` — no redirect | `api.ts:16` | CONFIRMED |
| 25 | **P1** | `/analytics/me` counts CANCELLED sales as earnings | `analytics.service.ts:28` | CONFIRMED — **FIXED** |
| 26 | **P1** | Earnings dip and reappear mid-lifecycle | `users.service.ts:26` | CONFIRMED — **FIXED** |
| 27 | **P2** | Prosumer cannot discover their own meter id | no `GET /meters` | CONFIRMED (inspection) |
| 28 | **P2** | Balance-invariant breach surfaces as a generic 500 | `credit-engine.service.ts:95` | CONFIRMED (inspection) |
| 29 | **P2** | `POST /credits/generate` returns `201` with `data: null` | `credits.controller.ts:27` | CONFIRMED (inspection) |
| 30 | **P3** | Dead code: `getPayment`, `_unused` import (`createNotification` now wired) | `payments.service.ts:171` | CONFIRMED — partly fixed |
| 31 | **P2** | Released listing stuck at `PARTIAL` when fully restored | `transactions.service.ts:238` | CONFIRMED — **FIXED** |

---

# P0 — Blockers

## Bug 1 — Minted credits disappear from the Sell page

**Status: CONFIRMED.** On the server that had been running normally for hours,
`prosumer1` held 13 credit batches: **12 `MINTED`, 1 `LISTED`, 0 `AVAILABLE`**.
`GET /credits?status=AVAILABLE` — the exact query the Sell page makes — returned
**0 batches**, while the dashboard advertised **179.05 EC "Avail to Sell"**.
After a fresh `npm run db:seed` the dropdown was *still* empty (1 credit, `LISTED`,
via Bug 6). The seller cannot list anything, on a fresh database or a running one.

### Error

A prosumer generates surplus, the simulator mints a credit batch, the dashboard's
"Avail to Sell" tile rises — and the credit-batch dropdown on `/prosumer/sell` stays
empty. The single core action of the seller module cannot be performed.

### Cause

`mintFromReading` creates the credit with `status: "AVAILABLE"`
(`apps/api/src/modules/credits/credit-engine.service.ts:58`), then enqueues a chain op
whose success callback overwrites that status:

```ts
// credit-engine.service.ts:78
await prisma.energyCredit.update({
  where: { id: credit.id },
  data: { blockchainTxHash: txHash, status: "MINTED" },
});
```

The chain queue drains every 3s (`jobs/scheduler.ts:31`) and in `CHAIN_MODE=simulated`
— the committed default — every op succeeds immediately with a fake hash. Within ~3s of
minting, every credit is `MINTED`.

`ProsumerSell.tsx:11` queries `/credits?status=AVAILABLE`, so those credits are filtered
out permanently. `MINTED` and `AVAILABLE` are being used to mean two different things at
once — "the on-chain record exists" and "this is sellable". They are orthogonal.

### Fix — APPLIED

Stop overloading `status` with chain state. The credit already has `blockchainTxHash` as
the on-chain marker, so the chain callback should only write that — drop
`status: "MINTED"` from the update at `credit-engine.service.ts:78`. Treat `MINTED` as
legacy: leave the enum value, stop writing it (removing it needs a migration and is not
worth the risk here).

On the read side, a sellable credit is one with quantity left, not one in a magic status.
Add a `sellable` filter to `listCreditsForOwner` (`credit-engine.service.ts:102`):

```
{ ownerId, availableKwh: { gt: 0 }, expiresAt: { gt: now },
  status: { notIn: ["FROZEN", "EXPIRED", "RETIRED"] } }
```

and point `ProsumerSell.tsx:11` at `GET /credits?sellable=true`. This also fixes Bug 6.

**Applied.** `listCreditsForOwner` now takes a `sellable` flag and returns a per-credit
`listableKwh` (availableKwh minus quantity already committed to `ACTIVE`/`PARTIAL`
listings), excluding expired and `FROZEN`/`EXPIRED`/`RETIRED`/`SETTLED` credits. The
chain callback writes `blockchainTxHash` only. Verified: prosumer1/2/3 went from 0
batches each to 40.85 / 68.83 / 41.14 kWh listable, and a freshly simulator-minted
batch now shows up in the dropdown.

---

## Bug 2 — Seller payout is understated by half the fee

**Status: CONFIRMED.** The Sell page renders `Platform & DISCOM fee (5%)`. Entering
20 kWh at Rs 4.25 displayed: gross **Rs 85.00**, fee **-Rs 4.25**, "Estimated net payout"
**Rs 80.75**. The server charges `PLATFORM_FEE_RATE=0.10`, so the real payout is
**Rs 76.50** — the seller is overpromised **Rs 4.25 on an Rs 85 sale**. Every historical
transaction charges exactly 10.0%: Rs 240 to Rs 24 fee / Rs 216 payout; Rs 120 to
Rs 12 / Rs 108; Rs 200 to Rs 20 / Rs 180; Rs 80 to Rs 8 / Rs 72.

### Error

The "Settlement escrow ledger" promises 95% of gross. The seller receives 90%.

### Cause

The rate is hardcoded in the component and was never reconciled with the server:

```ts
// ProsumerSell.tsx:29
const f = g * 0.05;
```

The server's rate is `env.platformFeeRate`, defaulting to **0.1**
(`apps/api/src/config/env.ts:19`, and `PLATFORM_FEE_RATE=0.10` in the live `.env`),
applied at `transactions.service.ts:137`. The seeder hardcodes `0.1` independently
(`seed-runner.ts:257`). Three copies of one constant; two agree and one does not.

### Fix — APPLIED (5% chosen as the true rate)

The two values had to be reconciled to one, and the product decision was that **5% is
the correct rate** — so the server came down to meet the UI, not the other way round.
The rate is now server-owned and fetched, so it cannot drift again:

1. `PLATFORM_FEE_RATE=0.05` in `apps/api/.env` and `.env.example`; the fallback in
   `config/env.ts` is now `0.05` so a missing env var cannot silently reinstate 10%.
2. `GET /users/dashboard` returns `platformFeeRate` (`users.service.ts`). The Sell page
   reads it and derives **both** the arithmetic and the displayed percentage from it —
   no literal percentage remains in JSX.
3. The seeder's independent copy is gone: `seed-runner.ts` imports `env.platformFeeRate`,
   so seeded history matches live trades.
4. `docs/IMPLEMENTATION_PLAN.md` (§ fee formula and the env template) updated to 0.05.

**Verified:** a live 10 kWh trade at Rs 4.20 produced gross Rs 42.00, fee Rs 2.10
(**5.0%**), payout Rs 39.90. Seeded history now reads Rs 240 to Rs 12 fee / Rs 228 payout
(was Rs 24 / Rs 216). The Sell page label renders "Platform & DISCOM fee (5%)" from the
server value.

Note this **raises every seller's payout by 5% of gross** versus the old behaviour, and
the database was reseeded so historical rows are consistent. Any transactions written
before this change would still carry a 10% fee.

The fee is exact, not estimated — only the payout line should be hedged.

---

## Bug 3 — Multi-seller trades lose the seller

**Status: CONFIRMED, with an exact reproduction.** `consumer1` bought 1 kWh from
`Solar-Pro-101` and 1 kWh from `Solar-Pro-102` in one basket. The created transaction
carried **`sellerId: NULL`**. After payment completed:

- `prosumer1`'s credit `sold` balance moved `0.0000` to `1.0000` — the energy definitively left their account.
- The transaction was **absent** from `GET /transactions` for `prosumer1`.
- `dashboard totalEarnings` stayed at **576.0000** — the sale earned them nothing on paper.

### Error

A prosumer's "Accrued Value" reads lower than their real earnings, and completed sales
are missing from any seller-side list. A sale filled from one listing is counted; one
filled from two or more is not.

### Cause

`Transaction.sellerId` is deliberately nulled when a purchase spans multiple listings:

```ts
// transactions.service.ts:108
sellerId = sortedAllocations.length === 1 ? listing.sellerId : null;
```

That is defensible for the `Transaction` row — a multi-seller trade has no single seller
— but three queries then treat `sellerId` as the authoritative seller index:

- `users.service.ts:25` — aggregates `where: { sellerId: userId }`, so earnings under-report.
- `transactions.service.ts:268` — filters `OR: [{ buyerId }, { sellerId }]`, so the sale is dropped.
- `analytics.service.ts:28` — same filter, so `soldKwh` under-reports.

The per-seller truth exists: `EnergyMatch` rows carry `sellerId`, `quantityKwh` and
`pricePerKwh` per allocation (`transactions.service.ts:109-119`). Nothing reads them for
the seller.

### Fix

Query through `EnergyMatch`, which is the correct grain for seller-side reporting.

- **Earnings** (`users.service.ts`): sum each match's own share rather than the
  transaction's `sellerPayout`. Per match the seller's share is
  `quantityKwh * pricePerKwh * (1 - platformFeeRate)`. Aggregate over matches where
  `sellerId = userId` and the parent transaction's status is in the earned set (Bug 26).
  Do the arithmetic in `decimal.js`, never in JS floats.
- **Sales list** (`transactions.service.ts:268`): widen to
  `{ OR: [{ buyerId: userId }, { sellerId: userId }, { matches: { some: { sellerId: userId } } }] }`.

Note the grain: one transaction can produce several matches for the *same* seller, so sum
matches — do not `distinct` them.

---

## Bug 4 — Missing ownership checks on meters and credits

**Status: CONFIRMED — all four vectors, live.** Using `prosumer1`'s token against
`prosumer2`'s resources:

| Probe | Result |
|---|---|
| `GET /credits/<prosumer2-credit-id>` | **HTTP 200** — full record incl. `ownerId`, `sourceMeterId`, `readingId` |
| `GET /meters/<prosumer2-meter>/readings` | **HTTP 200** — paged, **224 readings** exposed |
| `POST /meters/<prosumer2-meter>/readings` | **HTTP 201** — reading accepted and marked `VERIFIED` |
| `POST /credits/generate` as **consumer1** | **HTTP 409** (`CREDITS_ALREADY_ISSUED`) — reached business logic, so no role guard exists |

The first probe leaks precisely the `sourceMeterId` and `readingId` needed to exploit the
other two. The write probe used generation < consumption so no credits were minted; with
surplus it would mint real, sellable credits. The probe row was deleted afterwards.

### Error

Any authenticated user — including a `CONSUMER` — can read another prosumer's full
meter-reading history (sensitive behavioural data: when someone is home, their solar
output), inject fabricated readings into a meter they do not own, read any credit, and
drive the minting engine.

### Cause

Four handlers take an id from the URL or body and never compare it to `req.user`:

```ts
// meters.controller.ts:17 — no user passed at all
const result = await metersService.listReadings(req.params.id, page, pageSize);

// meters.controller.ts:26
const reading = await metersService.ingestReading(req.params.id, req.body);

// credits.controller.ts:17
const credit = await creditEngine.getCreditById(req.params.id);

// credits.controller.ts:26
const credit = await creditEngine.mintFromReading(req.body.readingId);
```

The services have no owner parameter either — `listReadings` (`meters.service.ts:23`)
filters only on `meterId`; `getCreditById` (`credit-engine.service.ts:109`) only on `id`.
`authMiddleware` establishes *who* the caller is and nothing checks *what* they may touch.
Contrast `marketplace.service.ts:15` and `:62`, which do it correctly.

The same pattern leaks seller financials on two adjacent routes:

- `GET /transactions/:id` (`transactions.service.ts:261`) — no buyer/seller check, so any
  user can read any transaction including `sellerPayout` and `platformFee`.
- `GET /settlements/:id` (`settlement.controller.ts:8`) — no `consumerId` check.

For scale: the entire API has **three** role gates — listing creation, audit, and the demo
routes. Everything else is "any authenticated user".

### Fix

Thread the caller through and assert ownership in the service layer, where the other
modules already do it:

- `listReadings(user, meterId, ...)` / `ingestReading(user, meterId, ...)`: load the meter,
  `if (meter.userId !== user.id) throw ApiError.forbidden(...)`. Allow
  `UTILITY`/`REGULATOR`/`ADMIN` through explicitly if oversight needs it.
- `getCreditById(user, id)`: `if (credit.ownerId !== user.id) throw ApiError.forbidden(...)`.
- `POST /credits/generate`: add `requireRole(Role.PROSUMER)` in `credits.routes.ts:11` and
  verify the reading's meter belongs to the caller inside `mintFromReading` — it already
  loads `fullReading.meter`, so it is one line at `credit-engine.service.ts:41`.
- `getTransaction` and the settlement handler: same ownership assertion.

Two more role gaps worth closing in the same pass: `POST /meters` (`meters.routes.ts:9`)
has no `requireRole`, so a `CONSUMER` can create a `SOLAR` meter and become a de-facto
prosumer; and `GET /analytics/market` (`analytics.routes.ts:7`) exposes platform-wide
volume and flagged-reading counts to every user.

Separately, `authMiddleware` (`auth.middleware.ts:29`) trusts the JWT `role` claim with no
DB lookup, so a `SUSPENDED` user keeps full access until their 7-day token expires. Out of
scope here, but worth tracking.

---

# P1 — Broken seller workflows

## Bug 5 — A seller cannot cancel a listing

**Status: CONFIRMED.** `DELETE /marketplace/listings/:id` works correctly when called
directly (verified via curl — HTTP 200, listing cancelled, credit freed). Nothing in
`apps/web/src` references it. A seller who mispriced has no recourse in the UI.

### Error

Once published, a listing is permanent from the UI.

### Cause

Purely a missing screen. The endpoint is routed (`marketplace.routes.ts:13`), controlled
(`marketplace.controller.ts:14`) and fully implemented with an ownership check and a
status guard (`marketplace.service.ts:58-75`).

There is also no "my listings" view: `GET /marketplace/listings`
(`marketplace.service.ts:77`) has no seller filter and hard-filters
`status: { in: ["ACTIVE","PARTIAL"] }`, so `SOLD`, `RESERVED`, `CANCELLED` and `EXPIRED`
listings are unreachable through any endpoint. Its projection also strips `sellerId`
(`:94-107`), so the frontend cannot even identify which listings are the caller's own.

### Fix

1. Add a `mine=true` option to `listingsQuerySchema`
   (`packages/shared/src/schemas/marketplace.ts:10`); when set, filter `sellerId: user.id`
   and widen the status filter so the seller sees their own history. Pass `req.user` into
   `listListings` — it currently takes only the query (`marketplace.controller.ts:25`).
   The PII redaction at `:93` protects *other* sellers and can be relaxed for own rows.
2. Build `/prosumer/listings` (`features/prosumer/ProsumerListings.tsx`), registered in
   `routes.tsx` beside the other prosumer routes. Each row: quantity, remaining, price,
   zone, status, and a **Cancel listing** button, disabled unless status is `ACTIVE` or
   `PARTIAL` (mirroring the server guard at `marketplace.service.ts:63`).
3. Confirm before cancelling — it is destructive and a buyer may be mid-flight.
4. On success invalidate `["credits","sellable"]`, `["dashboard","prosumer"]` and the
   listings key (Bug 18).

---

## Bug 6 — A partially-listed credit cannot be listed again

**Status: CONFIRMED, three times.** A credit with `availableKwh = 170.1266` backing a
130 kWh listing:

- The Sell page displayed **"Max available: 170.1266 kWh"** and the `+` stepper clamped to it.
- Listing **100 kWh** was rejected with `INSUFFICIENT_CREDITS` (HTTP 400).
- Bisection found the real ceiling at **~40 kWh** — the UI overstates it by **4.2x**.
- After successfully listing 40 kWh, the credit showed `status=LISTED, availableKwh=170.1266`
  and the dropdown dropped to **0 batches** — the seller was locked out of the rest.
- Repeated with a 20 kWh listing: dropdown went to 0 again.

### Error

A prosumer with a 170 kWh batch lists part of it. The batch disappears from the Sell
dropdown. They can never list the remainder.

### Cause

`createListing` flips the whole credit's status on any listing, however small:

```ts
// marketplace.service.ts:36
await tx.energyCredit.update({ where: { id: credit.id }, data: { status: "LISTED" } });
```

The service is otherwise careful here — the comment at `:17-19` notes that listing
deliberately does *not* move `availableKwh`, and `:20-28` correctly sums existing
`ACTIVE|PARTIAL` listings to prevent over-listing. The quantity accounting is right; only
the status flag is wrong, and the status flag is what `ProsumerSell.tsx:11` filters on.

### Fix — APPLIED

Covered by Bug 1's `sellable` filter: select on quantity, not status.

The dropdown must also show the *listable* remainder, not raw `availableKwh` — reuse the
`alreadyListed` aggregate from `marketplace.service.ts:20-23` and return it per credit so
`ProsumerSell.tsx:23` (`maxKwh`) reflects what the server will actually accept. Without
that, the stepper still climbs to a quantity the server rejects.

**Applied.** `createListing` marks a credit `LISTED` only when the whole balance is
committed, and the Sell page now shows `listableKwh` rather than `availableKwh`.
Verified: with 40.85 kWh genuinely listable, 45 kWh is rejected and 40.85 accepted —
the advertised ceiling and the server limit now agree. After listing 15 of it, the
batch stayed in the dropdown with 25.85 kWh left.

---

## Bug 7 — Cancelling one listing frees a credit held by another

**Status: CONFIRMED.** With a credit backing two listings (130 kWh and 40 kWh),
cancelling the 40 kWh listing set the credit to `AVAILABLE` while the 130 kWh listing was
still live against it.

### Cause

```ts
// marketplace.service.ts:69
await tx.energyCredit.update({ where: { id: listing.creditId }, data: { status: "AVAILABLE" } });
```

Unconditional, with a comment (`:67-68`) reasoning only about the cancelled listing's own
balance and not about sibling listings on the same credit — the exact case
`createListing:20-28` was written to support.

### Fix — APPLIED

Same root cause as Bugs 1 and 6: the credit's `status` is being used as a per-listing flag
when listings are many-to-one against a credit. Once `sellable` is computed from
quantities, this write can be deleted. If the status field is kept for display, recompute
it from the remaining `ACTIVE|PARTIAL` listings inside the same transaction.

**Applied.** `cancelListing` now aggregates the credit's remaining `ACTIVE`/`PARTIAL`
listings and only returns it to `AVAILABLE` if there is genuinely free balance.
Verified across the full cycle: committing the whole balance flips the credit to
`LISTED` and empties the dropdown; cancelling restores `AVAILABLE` and the remainder;
cancelling one of two listings leaves the other's claim intact.

---

## Bug 8 — The seller is never told anything happened

**Status: CONFIRMED (inspection).** Every lifecycle emit targets the buyer:

| Site | Recipient |
|---|---|
| `transactions.service.ts:198` `TRADE_MATCHED` | `buyer.id` |
| `payments.service.ts:63,104,127` `PAYMENT_UPDATED` | `txn.buyerId` |
| `settlement.service.ts:81` `SETTLEMENT_UPDATED` | `settlement.consumerId` |
| `credit-engine.service.ts:79,83` `CREDIT_MINTED` | `credit.ownerId` (the only seller-facing event) |

`CREDIT_MINTED` is the sole seller event, and no prosumer screen subscribes to it —
`useSocketInvalidate` is called exactly once in the whole app, in `SettlementDetail.tsx:34`.

### Error

A prosumer's credits are reserved, sold, paid for and settled with no signal on their
screen. They learn about it by reloading.

### Fix

1. Server: after each buyer emit, emit to the sellers too. Derive them from the
   transaction's `EnergyMatch` rows (`matchRows` is already in scope at
   `transactions.service.ts:198`); de-duplicate seller ids, since one seller can hold
   several matches in one trade.
2. Client: subscribe on the prosumer screens — `credit:minted` and `trade:matched`
   invalidating `["dashboard","prosumer"]` and `["credits","sellable"]`. Fix
   `useSocketInvalidate`'s dependency array first (`hooks/useSocket.ts:16`): it depends on
   `queryKey`, which every caller passes as an inline array literal, so the effect tears
   down and re-subscribes on every render. Memoize the key or depend on a serialized form.

---

## Bug 9 — The notification bell does nothing, and there are no notifications

**Status: CONFIRMED.** Inspecting the button's React props in the live page returned
`onClick` handlers: **`[]`** — no handlers at all. `aria-expanded` is `null`, and clicking
it left the DOM byte-identical.

### Cause

Two independent halves, both missing.

Frontend — the button has no handler (`AppShell.tsx:85-93`); it is a `<button>` wrapping an
emoji. `PATCH /notifications/:id/read` is implemented (`notifications.service.ts:8`) and
called from nowhere in `apps/web/src`.

Backend — `createNotification` (`notifications.service.ts:14`) has **zero call sites**; a
repo-wide search finds only its definition. The seeder never inserts rows either. So
`GET /notifications` always returns `[]` and `unread` (`AppShell.tsx:62`) is always 0 —
the badge can never appear, let alone be cleared.

### Fix

1. Call `createNotification` at the lifecycle points that matter to a seller — listing
   sold, payment received, settlement complete — alongside the Bug 8 emits, so the socket
   event and the persisted notification are written together.
2. Make the bell a real disclosure: a dropdown listing recent notifications, each marking
   itself read via the existing `PATCH` endpoint and invalidating `["notifications"]`. It
   needs `aria-expanded`, `aria-controls`, Escape-to-close and focus return to the trigger
   — it is a menu button, not decoration.
3. Seed a couple of notifications so the demo shows a non-zero badge.

---

## Bug 10 — Prosumers can buy their own listings

**Status: CONFIRMED on both layers.** In the UI, `prosumer1` (`Solar-Pro-101`) saw three
listings including their own, with **3 of 3 "Buy credits" buttons enabled**. Via the API,
`prosumer1` purchased 0.5 kWh of their own listing: **HTTP 201**, with
`buyerId === sellerId === 560e506a-...`, `totalAmount` Rs 2.10, `platformFee` Rs 0.21,
`sellerPayout` Rs 1.89. The seller paid the platform Rs 0.21 to trade with themselves.
(The probe transaction was cancelled and the database reseeded.)

### Cause

No guard on either side.

Client — `Marketplace.tsx:123-130` renders a Buy button for every row with no comparison
against the current user. It *cannot* make that comparison: `listListings` strips
`sellerId` from the projection (`marketplace.service.ts:94-107`), exposing only
`sellerAlias`.

Server — `createTransaction` validates the buyer but never compares `listing.sellerId` to
`buyer.id`. The ownership checks at `transactions.service.ts:254` and `:268` are about
*buyer* identity on existing transactions, not about self-dealing at creation.

### Fix

Server-side is the one that matters — it is the enforceable boundary. In
`createTransaction`'s allocation loop (`transactions.service.ts:~100`), reject any
allocation whose `listing.sellerId === buyer.id`. Add a `SELF_TRADE` code to `ERROR_CODES`
(`packages/shared/src/enums.ts:112`).

Client-side, filter self-listings out of the grid so the seller is not shown a button that
will fail. That needs the identity back: add a boolean `isOwn` to the listing projection,
computed server-side, which preserves the PII redaction the comment at `:93` protects.
`isOwn` is better than filtering the rows away — a seller seeing their own listing in the
market, marked and un-buyable, is useful feedback.

---

## Bug 11 — `reservedKwh` is written as a JS number

**Status: CONFIRMED (inspection).** Needs many reservations to become visible, so it was
not observable in the demo window; the code path is unambiguous.

### Error

After enough reservations a credit's balances stop summing to `quantityKwh` and
`assertInvariant` (`credit-engine.service.ts:92`) throws on the next mint — or worse, does
not throw and the seller's balances are quietly wrong.

### Cause

One field in one write is downgraded out of `Decimal`:

```ts
// transactions.service.ts:126
data: { availableKwh: cState.availableKwh,          // Decimal
        reservedKwh: cState.reservedKwh.toNumber(), // float
        status: cState.status },
```

`availableKwh` is passed as a `Decimal` on the same line. The column is `Decimal(18,4)`
(`schema.prisma:214`) and the README names "Decimal everywhere" as a core safety
principle. `.toNumber()` rounds to float64, reintroducing exactly the representation error
the invariant at `:92-99` exists to catch.

### Fix

Drop `.toNumber()`. The same leak occurs at three more write sites and should be fixed in
the same pass:

- `transactions.service.ts:237` — `increment`/`decrement` in `releaseReservation`
- `payments.service.ts:81` — the reserved-to-sold move
- `settlement.service.ts:107-108` — retirement

Then grep `.toNumber()` across `apps/api/src/modules`: anywhere the result feeds a Prisma
write or a monetary comparison is the same bug. It is legitimate only at the edges —
`grid.service.ts:15` uses it for a ratio in a threshold comparison, which is fine.

This is the one place the codebase's otherwise-strict decimal discipline leaks, and it
leaks on the seller's balance specifically.

---

## Bug 12 — Expiry is enforced only at the last moment

**Status: CONFIRMED (inspection).** No credit in the seeded database was past `expiresAt`
(72h validity, fresh seed), so the symptom was not observable; the absence of any expiry
job in `scheduler.ts` and of any `expiresAt` check in `createListing` is definite, and no
credit anywhere carries status `EXPIRED`.

### Error

A credit can still be listed after it expires, and the stale listing sits in the
marketplace looking live. Buyers who click it get a `CREDIT_EXPIRED` error at reservation
time — the failure surfaces to the *buyer*, at the last possible moment, for a listing the
*seller* should never have been able to publish.

### Cause

The expiry check exists at exactly one point in the lifecycle — reservation
(`transactions.service.ts:97`) — and nowhere else.

No expiry job exists: `startScheduler` (`jobs/scheduler.ts:11-36`) runs four tasks —
simulator, pricing, settlement poll, chain queue — and none touches `expiresAt`. So
`CreditStatus.EXPIRED` and `ListingStatus.EXPIRED` (`enums.ts:51`, `:61`) are never
written. And `createListing` (`marketplace.service.ts:10-56`) has no `expiresAt`
comparison anywhere in the function.

### Fix

1. Add an expiry tick to `startScheduler` (every 60s is ample): mark credits with
   `expiresAt < now` and `availableKwh > 0` as `EXPIRED`, and their `ACTIVE`/`PARTIAL`
   listings likewise. Do not touch credits with `reservedKwh > 0` — a reservation is
   mid-trade and has its own TTL (`env.reservationTtlMinutes`).
2. Guard at creation: reject in `createListing` if `credit.expiresAt <= now`, using the
   existing `CREDIT_EXPIRED` error code (`enums.ts:120`, currently unused).
3. Exclude expired credits from the `sellable` filter (Bug 1) and surface expiry in
   `ProsumerCredits.tsx` — it renders `expiresAt` at `:21` but styles it identically
   whether it is a week away or long past.

---

## Bug 13 — No prosumer sales view; the nav lies about where it goes

**Status: CONFIRMED.** Reading the live nav: the item labelled **"Txns"** has
`href="/prosumer/credits"`. There is no prosumer transactions route in `routes.tsx`.

### Cause

The mislabel is at `AppShell.tsx:31`:

```ts
{ key: "transactions", label: "Txns", icon: "▤", to: "/prosumer/credits" },
```

The data exists and is reachable: `GET /transactions` already returns rows where the
caller is buyer *or* seller (`transactions.service.ts:268`). Only `/consumer/transactions`
renders it. The backend supports the screen; the screen was never built.

### Fix

Build `/prosumer/transactions`, modelled on `features/consumer/ConsumerTransactions.tsx`
but from the seller's side: quantity sold, gross, fee, net payout, status, counterparty
alias. Point the "Txns" nav item at it and relabel the `/prosumer/credits` entry to
"Credits". Depends on Bug 3 — until matches are queried, this screen will under-report
exactly as the earnings tile does.

---

## Bug 25 — `/analytics/me` counts cancelled sales as earnings

**Status: CONFIRMED, to the paisa.** After a 0.5 kWh self-trade probe was **CANCELLED**,
`/analytics/me` moved from `earnings 576.00 / soldKwh 160.00` to
**`earnings 577.89 / soldKwh 160.50`** — deltas of exactly Rs 1.89 and 0.50 kWh, precisely
the cancelled transaction's payout and quantity. Meanwhile `/users/dashboard` stayed at
576.00. The two endpoints disagreed by Rs 1.89, and the higher one was counting a sale that
never happened.

### Cause

`myAnalytics` (`analytics.service.ts:28`) filters on `sellerId` with **no status filter at
all**, so `CANCELLED`, `PAYMENT_FAILED` and still-`RESERVED` transactions count as realised
earnings. `users.service.ts:26` does filter
(`["COMPLETED","SETTLED","CREDIT_TRANSFERRED"]`). Neither list is shared; the whitelist is
duplicated by omission.

### Fix

Extract a single `SELLER_EARNED_STATUSES` constant in `apps/api/src/config/constants.ts`
and use it in both places — alongside the Bug 3 rewrite, since both queries move to
`EnergyMatch` at the same time.

---

## Bug 26 — Earnings dip and reappear as a sale progresses

**Status: CONFIRMED (inspection).** The intermediate state was not caught mid-flight
during the live pass; the whitelist omission is definite.

### Error

A prosumer watching their dashboard through a sale sees "Accrued Value" rise at
`CREDIT_TRANSFERRED`, **drop back** at `SETTLEMENT_PENDING`, then reappear at `SETTLED`.
It reads like money was lost.

### Cause

The status whitelist at `users.service.ts:26` is
`["COMPLETED","SETTLED","CREDIT_TRANSFERRED"]`, but the state machine
(`transactions/state-machine.ts:12`) routes through `SETTLEMENT_PENDING` between
`CREDIT_TRANSFERRED` and `SETTLED`. That state was omitted, so the row falls out of the
aggregate for the duration.

### Fix

Add `SETTLEMENT_PENDING` to the shared constant from Bug 25. Derive the list from the
state machine's terminal-and-beyond states rather than hand-listing it, so a future state
cannot fall through the same gap. Worth a test that walks a transaction through every
state and asserts earnings are monotonic.

---

# P2 — Correctness and UX

## Bug 14 — `useAuth` is per-component state

**Status: CONFIRMED (inspection).**

`hooks/useAuth.ts:8` is a plain hook holding its own `useState`, seeded from
`localStorage`. It is not a context, and there is no provider anywhere in the app. Every
caller — `AppShell:51`, `ProsumerDashboard:17`, `ProfilePage:7`, `RequireAuth` in
`routes.tsx:20` — gets an independent copy. `logout()` in `ProfilePage` clears storage and
its own state while `AppShell` still renders the old user; `login()` does not propagate to
mounted components. It currently appears to work only because logout is immediately
followed by `navigate("/login")` (`AppShell:124-127`), which unmounts the tree.

`JSON.parse(localStorage.getItem("user"))` at `:10` is also unguarded — malformed storage
throws during render, with no error boundary to catch it (`main.tsx` has none).

**Fix.** Convert to a real `AuthProvider` context in `main.tsx` wrapping `BrowserRouter`,
with `useAuth` reading from it. Wrap the `JSON.parse` in try/catch returning `null`. Keep
the `localStorage` write-through so refresh still restores the session.

---

## Bug 15 — Socket token is captured once and never refreshed

**Status: CONFIRMED (inspection).**

`lib/socket.ts:5-12` builds the socket lazily and reads the token **inside the
`if (!socket)` branch**, so it is captured at first connect and held for the page's
lifetime. Log out and back in as a different prosumer and the socket is still
authenticated as the first user, receiving their `user:<id>` room events — including the
`CREDIT_MINTED` events of Bug 8. The singleton is never disposed on logout
(`useAuth.ts:31-35` clears storage only).

**Fix.** Export a `disconnectSocket()` that closes the socket and nulls the singleton;
call it from `logout()`. Reconnect with the fresh token on next `getSocket()`.

---

## Bug 16 — "Avail to Sell" contradicts the Sell page

**Status: CONFIRMED.** The dashboard tile read **"AVAIL TO SELL — 179.05 EC — Ready for
market"**, the header pill read **"179.05 EC · Rs 576.00"**, and the Sell button was
labelled **"Sell surplus energy credits (179.05 EC)"** — while `/prosumer/sell` offered
**0 batches**. Two screens, flatly contradicting each other.

### Cause

`prosumerDashboard` (`users.service.ts:13`) sums `availableKwh` across **all** the owner's
credits with no status or expiry filter, so expired, frozen and fully-listed batches are
counted. The Sell page filters on status. Neither number is the truth.

**Fix.** Filter the aggregate to the same `sellable` predicate as Bug 1, so the number the
seller is shown is the number they can act on.

Also note `ProsumerDashboard.tsx:23` computes `total = available + reserved + sold`,
omitting `retired` even though the API returns it — so the three progress bars (`:48-50`)
are percentages of the wrong denominator once anything is retired.

---

## Bug 17 — `MarketplaceListingDTO` does not match the API

**Status: CONFIRMED.** The live response keys are
`createdAt, creditId, expiresAt, gridZoneId, id, pricePerKwh, quantityKwh, remainingKwh,
sellerAlias, status, zoneCode, zoneName`. **`sellerId` is absent; `zoneCode` is present** —
the exact opposite of the DTO.

### Cause

`packages/shared/src/types.ts:102-115` declares a required `sellerId: string` and no
`zoneCode`. `listListings` (`marketplace.service.ts:94-107`) deliberately omits `sellerId`
(privacy, per the comment at `:93`) and adds `zoneCode`. `Marketplace.tsx:15` types its
query as `MarketplaceListingDTO[]`, so `l.sellerId` type-checks and is `undefined` at
runtime — the exact field Bug 10's client-side fix would reach for. Nothing catches it
because no runtime validation is applied to responses.

**Fix.** Correct the DTO to match the projection (drop `sellerId`, add `zoneCode`, add the
`isOwn` flag from Bug 10). Longer term, derive the DTO from a Zod schema in
`packages/shared/src/schemas/marketplace.ts` and parse responses, so the two sides cannot
drift silently again.

The same drift affects the prosumer dashboard, which has **no shared DTO at all**:
`users.service.ts:30-40` returns an ad-hoc object that the frontend re-declares in two
places — `ProsumerDashboard.tsx:10-14` and `AppShell.tsx:11` — and inconsistently (the
AppShell copy omits `creditCount`). Add a `ProsumerDashboardDTO` to
`packages/shared/src/types.ts` and import it in both. Other DTOs drift from their Prisma
rows the same way — `MeterDTO` omits `ratedKw`, `TransactionDTO` omits
`idempotencyKey`/`chainAttempts`/`failureReason` (all observed on the wire),
`SettlementDTO` omits `attempts`/`settledAt` — because those routes return raw Prisma rows.

---

## Bug 18 — Publishing a listing leaves the rest of the app stale

**Status: CONFIRMED.** Header pill before publishing: **"179.05 EC · Rs 576.00"**. After a
successful publish (message: "Listing broadcast to the P2P market."): **identical**. No
refetch occurred.

### Cause

`ProsumerSell.tsx:44` calls only its own `refetch()`. The dashboard tiles and the header
pill both read `["dashboard","prosumer"]`, which is never invalidated. There is no
`useApiMutation` — every write in the app is a raw `api.post` with hand-rolled
`busy`/`message` state and no cache integration.

**Fix.** Add a `useApiMutation` beside `useApiQuery` in `hooks/useApi.ts` wrapping
`useMutation`, taking the keys to invalidate on success. Use it for listing creation,
listing cancellation (Bug 5) and the marketplace buy, invalidating
`["dashboard","prosumer"]`, `["credits","sellable"]` and `["marketplace","listings"]`.

---

## Bug 19 — Price band shown but not enforced

**Status: CONFIRMED.** The page displayed **"Allowed range: Rs 2.5–Rs 7/kWh in Ahmedabad
West"** while the price input defaulted to a hardcoded **4.25**, unrelated to the zone's
`basePrice` of 4.00. No client-side validation binds the input to the band.

### Cause

`ProsumerSell.tsx:12` fetches `/grid/zones` and `:136-140` displays the band, but nothing
stops submission outside it. The server rejects with `PRICE_OUT_OF_BAND`
(`marketplace.service.ts:32-33`) — correct, but the seller only finds out after a
round-trip, via the same undifferentiated grey message as success (Bug 22). The default
price `"4.25"` (`:16`) is a magic constant.

**Fix.** Validate against `selectedZone.priceFloor`/`priceCeiling` on change, disable
submit and show the violation inline. Default the price input to the zone's `basePrice`
once a batch is selected. Keep the server check — client validation is UX, the server is
the boundary.

---

## Bug 20 — Quantity `max` is not enforced

**Status: CONFIRMED.** With `max="170.1266"` on the input, typing **100** left the Publish
button **enabled**; clicking it produced a server `INSUFFICIENT_CREDITS` rejection (the
true ceiling being ~40 — see Bug 6).

### Cause

`ProsumerSell.tsx:104` sets `max={maxKwh || undefined}`, which browsers treat as a hint for
steppers only; typing a larger number is unimpeded. The submit guard at `:163` tests
truthiness (`!quantityKwh`), not range. The `+` button does clamp (`:114`), so the two
input paths disagree.

**Fix.** Validate `0 < qty <= listableMax` (the Bug 6 remainder, not raw `availableKwh`),
disable submit, and show the limit inline.

---

## Bug 21 — The sell form is not a form

**Status: CONFIRMED.** `document.querySelector('select').closest('form')` returned
**null** — the controls are not inside a `<form>`. Pressing Enter in either numeric input
does nothing.

### Cause

`ProsumerSell.tsx:59-169` is a `<Card>` of inputs with a click handler on the button — no
`<form>`, no `onSubmit`.

**Fix.** Wrap in `<form onSubmit={...}>` with `preventDefault`. Note that `Button`
(`components/ui/Button.tsx:18`) sets no default `type`, so it defaults to `submit`: the
`+`/`-` steppers already set `type="button"` (`:95`, `:112`), and the primary button needs
`type="submit"`. Give `Button` a default `type="button"` so this class of bug cannot recur
elsewhere.

---

## Bug 22 — Success and failure look identical

**Status: CONFIRMED.** The error "Not enough available EC to list" rendered with
`className="font-mono text-sm"`, computed colour **`rgb(27, 27, 27)`** (near-black — the
same as success text), and **`role: null`** so it is not announced to assistive tech. The
success message "Listing broadcast to the P2P market." rendered identically.

### Cause

`ProsumerSell.tsx:17` holds one `message: string | null` used for both outcomes and `:159`
renders it in plain text either way. Error text elsewhere in the app uses `text-fault`
(`Marketplace.tsx:95`), so the convention exists and this screen ignores it.

**Fix.** Split into `{ kind: "ok" | "error", text }`, style errors with `text-fault`, and
give the region `role="status"` / `role="alert"`.

---

## Bug 23 — `ProsumerCredits` is inert

**Status: CONFIRMED.** The live page rendered **13 credit cards and 0 interactive
elements** inside `<main>` — no buttons, links, inputs or selects. Status badges rendered
`MINTED` and `AVAILABLE`.

### Cause

The screen (`features/prosumer/ProsumerCredits.tsx`) has no per-batch "Sell this batch"
action, no filter, no sort, no detail link. `useApiQuery` returns `isLoading`/`isError` and
the component destructures only `data` (`:8`), so the empty state at `:32`
(`data?.length === 0`) renders nothing while loading and nothing on failure — a failed
fetch is indistinguishable from an empty account. `StatusBadge` treats only
`AVAILABLE`/`LISTED` as live (`:25`), so the `MINTED` credits that dominate real data
render as idle grey.

**Fix.** Destructure `isLoading`/`isError` and render all three states. Add a "Sell this
batch" button per row deep-linking to `/prosumer/sell?creditId=...` with `ProsumerSell`
reading the param to preselect. Once Bug 1 lands, drive the badge off sellability rather
than a status allowlist.

---

## Bug 27 — A prosumer cannot discover their own meter

**Status: CONFIRMED (inspection).**

`GET /meters/:id/readings` requires a meter id. There is no endpoint that tells a prosumer
what their meter ids are — no `GET /meters` and no `GET /meters/:id`. Only three meter
routes are registered (`meters.routes.ts:9-11`): create, list-readings, ingest-reading.
`docs/backend.md:274` specifies `GET /meters/:id`; it was never built. The readings API is
effectively unreachable for its intended caller, which is why no frontend screen uses it.

**Fix.** Add `GET /meters` returning the caller's own meters (scoped by
`userId: req.user.id`, which sidesteps Bug 4 by construction). This unblocks a
generation-history view on `/prosumer` — currently the dashboard shows portfolio balances
but nothing about the solar generation that produced them, which is the prosumer's actual
physical activity.

---

## Bug 28 — Invariant breach surfaces as an opaque 500

**Status: CONFIRMED (inspection).**

`assertInvariant` (`credit-engine.service.ts:95,98`) throws a raw `Error`, not an
`ApiError`. The error middleware (`error.middleware.ts:10-11`) maps anything that is not an
`ApiError` to a generic `500 INTERNAL_ERROR`, so the single most important correctness
guard in the credit engine — the one protecting the balance invariant named in the README
— reports as an unhandled crash with no error code and no indication of which credit was
affected.

**Fix.** Throw a typed `ApiError` with a distinct code and the credit id in the detail
payload, and log at `error` level with the full balance breakdown. This is the alarm for
Bug 11; it should be legible when it fires.

---

## Bug 29 — `POST /credits/generate` returns `201` with a null body

**Status: CONFIRMED (inspection).** The live probe hit `CREDITS_ALREADY_ISSUED` first, so
the null path was not reached; the code path is unambiguous.

When a reading has no surplus, `mintFromReading` marks it consumed and returns `null`
(`credit-engine.service.ts:43-46`). The controller passes that straight through:
`ok(res, credit, undefined, 201)` (`credits.controller.ts:27`) — a `201 Created` announcing
a resource that was not created, with `data: null`, which no `ApiSuccess<EnergyCreditDTO>`
consumer is typed to handle.

**Fix.** Return `200` with an explicit `{ minted: false, reason: "NO_SURPLUS" }`. Reserve
`201` for an actual mint.

---

## Bug 31 — A released listing is stuck at `PARTIAL`

**Status: CONFIRMED.** After cancelling a 0.5 kWh reservation against a 130 kWh listing,
the listing returned to its full **130.0000 kWh remaining** but its status stayed
**`PARTIAL`** — a fully-intact listing permanently labelled as partially sold.

### Cause

```ts
// transactions.service.ts:238
data: { remainingKwh: { increment: match.quantityKwh.toNumber() },
        status: listing.status === "RESERVED" ? "ACTIVE" : "PARTIAL" },
```

The status is chosen from the listing's *previous* status rather than recomputed from the
restored quantity, so a `PARTIAL` listing that is now whole again stays `PARTIAL`.
(The same line carries the `.toNumber()` precision leak of Bug 11.)

**Fix.** Recompute from the restored quantity:
`remainingKwh.equals(quantityKwh) ? "ACTIVE" : "PARTIAL"`, in `Decimal` arithmetic. The
same release path also sets the credit to `AVAILABLE` unconditionally, which is Bug 7's
failure mode — fix both together.

---

# P3

## Bug 24 — 401 clears the token but leaves the user

**Status: CONFIRMED.** With an invalid token, reloading `/prosumer` produced: token
cleared from storage (**true**), `user` still in storage (**true**), still on `/prosumer`
(**no redirect**), and the dashboard rendered in full — "Prosumer Node — Solar-Pro-101",
a green **"Online"** badge, and every tile showing **"—"**.

### Cause

`lib/api.ts:16-19` removes only `token` on a 401 and re-rejects. `user` stays, so
`isAuthenticated` (`useAuth.ts:37`) remains true and `RequireAuth` (`routes.tsx:20`) keeps
passing. Nothing navigates. The hardcoded "Online" badge
(`ProsumerDashboard.tsx:31`) makes the dead session look healthy.

**Fix.** Clear the stored user too, and redirect to `/login`. With the Bug 14 provider in
place, call the context's `logout()` from the interceptor rather than hard-navigating, so
app state and URL stay consistent.

---

## Bug 30 — Dead code on the seller path

**Status: CONFIRMED (inspection).** Three leftovers, harmless but misleading when reading
the module:

- `payments.service.ts:171` `getPayment(transactionId)` — implemented, exported, never
  imported; there is no `GET /payments/:id` route.
- ~~`notifications.service.ts:14` `createNotification`~~ — now the single write path for notifications, called via `lib/notify.ts` (fixed with Bug 9).
- `credit-engine.service.ts:5,14` — `nextTransactionId as _unused` imported and then
  `void _unused;`.

**Fix.** Delete the `_unused` import. Either route `getPayment` or delete it.
`createNotification` gets wired up by Bug 9.

---

# Not bugs — scope gaps worth naming

These are absences by design, not defects. Listed so nobody goes looking for them:

- **No wallet.** `User.walletAddress` (`schema.prisma:128`) is read by `ProfilePage.tsx:41`
  and **written by nothing**. No wallet model, route or service exists.
- **No payouts.** `sellerPayout` is a computed column on `Transaction`
  (`transactions.service.ts:138`) and nothing more — no ledger, no balance, no withdrawal.
  A prosumer's "earnings" is a sum over historical rows, not money they can move.
- **No offers, bids or counter-offers.** The only matching is the buyer-initiated greedy
  allocation in `matching-engine.service.ts:25`. Sellers post a price and wait.
- **Route naming drifts from `docs/backend.md`**, which specifies `POST /marketplace/list`,
  `GET /marketplace`, `DELETE /marketplace/:id` (`:431`, `:465`, `:489`) against the
  implemented `/marketplace/listings...`. The code is self-consistent; the doc is stale.
  Also missing versus the doc: `GET/PUT /users/me`, `GET /meters/:id`, `POST /settlements`.

If the demo narrative claims a prosumer "gets paid", the first two deserve a line of
acknowledgement in the README rather than a fix.

---

# Recommended fix order

Several of these share a root cause; this order avoids rework.

1. ~~**Bugs 1 + 6 + 7 together**~~ — **DONE.** Stopped using `CreditStatus` as a
   per-listing flag; introduced the `sellable` predicate. Unblocks 16 and 23.
2. ~~**Bug 4**~~ — **DONE.** Ownership and role checks across meters, credits,
   transactions, settlements and analytics, behind a shared `lib/authorize.ts`.
3. ~~**Bugs 11 + 31**~~ — **DONE.** `.toNumber()` leaks removed; released listing status
   recomputed. **Bug 28** (invariant throws a raw Error, so a breach reports as an opaque
   500) is still open and is the natural companion — it is the alarm for Bug 11.
4. ~~**Bugs 3 + 25 + 26**~~ — **DONE.** Seller earnings moved to `EnergyMatch` behind a
   shared earned-status list. Unblocks 13.
5. ~~**Bug 2**~~ — **DONE.** Rate set to 5% and made server-owned.
6. ~~**Bug 10**~~ — **DONE.** `SELF_TRADE` guard server-side plus `isOwn` on the client
   (which also corrected the `MarketplaceListingDTO` drift, **Bug 17**).
7. ~~**Bug 12**~~ — **DONE.** Expiry tick plus a guard at listing creation.
8. **Bugs 14 + 15 + 24** — auth context, socket lifecycle, 401 handling. One coherent
   session-management pass.
9. ~~**Bug 18 + 5 + 13**~~ — **DONE.** `useApiMutation`, the my-listings screen with
   withdraw, and the seller-side sales screen.
10. ~~**Bugs 8 + 9**~~ — **DONE.** Seller-facing socket events and a working notification menu.
11. **Bugs 19–23** — Sell-form hardening and `ProsumerCredits`, as one pass.
12. **Bugs 17 + 27 + 29 + 30** — shared DTOs, `GET /meters`, response-shape and dead-code
    cleanup. Low risk, do last.

Done so far: **1, 2, 3, 4, 6, 7, 10, 11, 17, 25, 26, 31** — every P0, and the P1s that
touch money, security or balance integrity.

Every P0 and P1 is now closed. What remains is P2/P3 polish: the session-management pass
(**14 + 15 + 24** — auth context, socket token lifecycle, 401 redirect) is the most
substantive, then Sell-form hardening (**19–23**) and the DTO/dead-code cleanup
(**17 + 27 + 29 + 30**). **Bug 28** (invariant breach reports as an opaque 500) is small
and worth doing whenever the credit engine is next touched.

---

# Files affected

New files a fix pass would add:

- `apps/web/src/features/prosumer/ProsumerListings.tsx` (Bug 5)
- `apps/web/src/features/prosumer/ProsumerTransactions.tsx` (Bug 13)
- `apps/web/src/components/NotificationMenu.tsx` (Bug 9)
- `apps/api/src/jobs/expiry.ts` (Bug 12)
- `apps/api/tests/prosumer-listing.test.ts` (regressions for 1, 6, 7, 10)

Existing files most affected:

`apps/api/src/modules/credits/{credit-engine.service,credits.controller,credits.routes}.ts`,
`apps/api/src/modules/marketplace/marketplace.{service,controller}.ts`,
`apps/api/src/modules/transactions/transactions.service.ts`,
`apps/api/src/modules/meters/{meters.controller,meters.service}.ts`,
`apps/api/src/modules/users/users.service.ts`,
`apps/api/src/modules/analytics/analytics.service.ts`,
`apps/api/src/modules/settlement/settlement.{controller,service}.ts`,
`apps/api/src/modules/payments/payments.service.ts`,
`apps/api/src/config/constants.ts`,
`apps/api/src/jobs/scheduler.ts`,
`packages/shared/src/{types.ts,enums.ts,schemas/marketplace.ts}`,
`apps/web/src/features/prosumer/*`,
`apps/web/src/components/layout/AppShell.tsx`,
`apps/web/src/hooks/{useApi,useAuth,useSocket}.ts`,
`apps/web/src/lib/{api,socket}.ts`,
`apps/web/src/routes.tsx`.

---

# Regression checks for a fix pass

**Setup.** `npm install`; ensure `apps/api/.env` exists; `npm run db:generate && npm run
db:migrate && npm run db:seed`; `npm run dev`. API `:5000`, web `:5173`. Log in as
`prosumer1@demo.in` / `demo1234`.

**Existing automated suites must stay green** — `npm test`, especially
`tests/double-spend.test.ts` and `tests/multi-allocation.test.ts`, which exercise the
reservation path touched by Bugs 3, 11 and 31. `npm run check:invariants -w apps/api` must
pass after Bug 11 — it is the script that would have caught the precision drift.

**New tests** (`tests/prosumer-listing.test.ts`): list part of a batch and confirm the
remainder is still listable (6); two listings on one credit, cancel one, confirm the other
still holds (7); mint via `mintFromReading`, drain the chain queue, confirm the credit is
still sellable (1); attempt a self-purchase and expect `SELF_TRADE` (10); cancel a
reservation and assert the listing returns to `ACTIVE` (31).

**The check that proves Bug 1 is fixed:**

1. Note the batch list on `/prosumer/sell`.
2. Wait one simulator tick (`SIM_TICK_MS`, default 30s) plus a chain drain (3s).
3. The new batch **must** appear in the dropdown, and the dashboard's "Avail to Sell" must
   equal the sum of what the dropdown offers. Today those two numbers were 179.05 EC and 0.

**Manual passes:**

- Sell page: fee line reads 10% and net payout matches the transaction's `sellerPayout`
  after a real sale (2). Price outside the band and quantity above max are both blocked
  client-side with a red inline message (19, 20, 22). Enter submits (21).
- Publish a listing; the header EC/Rs pill updates without a reload (18).
- `/prosumer/listings`: cancel a listing; it leaves `/marketplace` and the credit becomes
  listable again (5).
- `/marketplace` as `prosumer1`: own listings marked and un-buyable; force the request with
  curl and expect `SELF_TRADE` (10).
- Buy from `prosumer1` as `consumer1@demo.in` across **two** listings; `/prosumer`
  "Accrued Value" includes it and it appears in `/prosumer/transactions` (3, 13). Compare
  `/users/dashboard` against `/analytics/me` — they must agree (25) — and poll
  `totalEarnings` across the state machine, which must never decrease (26).
- While that purchase completes, `prosumer1`'s window updates live and the bell shows an
  unread badge that clears on read (8, 9).
- Log out and in as `prosumer2@demo.in`; no `prosumer1` socket events arrive (15).

**Security checks (Bug 4).** With `prosumer1`'s token these six currently succeed and must
all return 403:

```
GET  /api/v1/credits/<prosumer2-credit-id>
GET  /api/v1/meters/<prosumer2-meter-id>/readings
POST /api/v1/meters/<prosumer2-meter-id>/readings
POST /api/v1/credits/generate   { "readingId": "<prosumer2-reading-id>" }
GET  /api/v1/transactions/<a-transaction-prosumer1-is-not-party-to>
GET  /api/v1/settlements/<someone-elses-settlement-id>
```

With a `consumer1` token, `POST /credits/generate` and `POST /meters` must be refused on
role alone.

Use a throwaway prosumer for write probes — a successful `POST /meters/:id/readings` with
surplus **mints real credits**. Reseed with `npm run db:seed` afterwards.

---

# Notes on demo state

The live pass created and then removed test artifacts (an IDOR probe reading, a cancelled
self-trade, two test listings, one multi-seller purchase). The database was **reseeded with
`npm run db:seed` at the end of the audit**, so demo state is clean.

One thing to know before demoing: on a freshly seeded database, `prosumer1` has exactly one
credit batch and the seeder lists part of it, which flips it to `LISTED` — so
**`/prosumer/sell` shows an empty dropdown from the very first second**, via Bugs 1 and 6
together. This is not a data problem; it is the headline bug, visible immediately on a
clean install.
