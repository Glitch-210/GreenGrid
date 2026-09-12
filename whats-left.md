What's left / gaps

1. Contract not deployed — BLOCKED ON ONE HUMAN STEP: funding the operator wallet.

   Done: live-mode code is ready (transfer uses real creditIds, seeded credits lazily mint on
   first touch, tx hashes link to the Amoy explorer); hardhat's missing peer deps installed so
   `npm run compile` and `npm test` work (3/3 pass); throwaway operator keypair generated into
   packages/contracts/.env (gitignored) and mirrored into apps/api/.env; RPC switched to
   https://polygon-amoy-bor-rpc.publicnode.com because rpc-amoy.polygon.technology does not
   resolve (chainId 80002 confirmed).

   Operator address: 0x413a3Fed0435d11Afac103A55a7BB0460adF6a48 — balance 0.0 POL.

   To finish:
   a. Fund that address from an Amoy faucet (https://faucet.polygon.technology — needs a
      captcha/login, so it can't be scripted). A few tenths of a POL is plenty.
   b. `cd packages/contracts && npm run deploy:amoy`
   c. Put the printed address in SMART_CONTRACT_ADDRESS in BOTH packages/contracts/.env
      (for check:amoy) and apps/api/.env, then set CHAIN_MODE=live in apps/api/.env.
   d. `npm run check:amoy` — confirms the signer is the contract's operator and has gas.
   CHAIN_MODE=simulated remains the one-line fallback (§14) and is still the current setting.
2. ~~No double-spend integration test~~ — DONE. `apps/api/tests/double-spend.test.ts` covers the §10
   mandatory race: two concurrent full-quantity purchases of the last 100 EC (exactly one wins), a
   60+60-against-100 partial-fill race, and idempotency-key replay. Needs a real Postgres — it runs
   against DATABASE_URL, or TEST_DATABASE_URL when set. Fixtures are DSTEST-prefixed and cleaned up,
   so it never touches demo data. Verified falsifiable: strip the FOR UPDATE locks and Serializable
   isolation from createTransaction and both purchases succeed, failing the test.
   The §10 risk row's "retry once on P2034" is also in — createTransaction retries a serialization
   failure once, so the losing buyer gets a clean 409 INSUFFICIENT_CREDITS instead of a raw
   Postgres 40001. A second consecutive loss maps to the same 409 rather than a 500.
3. ~~No idempotent-payment / duplicate-reading integration tests yet~~ — DONE.
   `apps/api/tests/payments-idempotency.test.ts` and `apps/api/tests/duplicate-reading.test.ts` cover
   the §10 rows "Idempotent payment: same key twice → one Payment row" and "Duplicate `externalId`
   reading → one credit batch only", each with a sequential-replay case and a genuine concurrent-race
   case (two calls fired without awaiting, `Promise.allSettled`).
   The concurrent cases exposed a real gap: `createPayment` and `ingestReading` only guarded replay
   with a `findFirst`-then-`create`, so two requests racing past that check hit a raw Prisma P2002
   unique-constraint error instead of converging on one row (unlike `createTransaction`'s P2034 retry).
   Fixed both: a new `apps/api/src/lib/prisma-errors.ts` (`isUniqueConstraintOn`) lets each service
   catch the P2002 and re-fetch/return the winner's row; `createPayment` also had to stop treating a
   concurrent replay's `PAYMENT_PENDING -> PAYMENT_PENDING` re-entry as an illegal transition.
   Verified falsifiable: reverting the P2002 catch in `payments.service.ts` and re-running the
   concurrent test reproduces the raw unique-constraint rejection.
   Fixtures (`tests/helpers/payments-fixture.ts`, `tests/helpers/readings-fixture.ts`) follow the same
   DSTEST-prefixed seed/reset/cleanup shape as `double-spend-fixture.ts`, with their own natural keys
   so all three integration test files can run concurrently against the same database.
4. README checklist unchecked — the "Definition of done" boxes in README.md are all still [ ], though functionally most now pass (seed works, invariant holds). Worth ticking off and adding the E2E demo-script rehearsal + backup video, which aren't done.
5. ~~Not yet manually walked through the UI~~ — DONE, with real findings. Ran `npm run dev` against a
   freshly reset+reseeded Neon DB (`CHAIN_MODE=simulated`) and walked the §12 script by hand in a
   browser (Chrome via claude-in-chrome), logging in as each demo role. The core engine genuinely
   works end-to-end — a purchase via the Marketplace "Buy credits" button rides the full lifecycle
   `PENDING → MATCHED → RESERVED → PAYMENT_PENDING → PAID → CREDIT_TRANSFERRED → SETTLEMENT_PENDING →
   SETTLED → COMPLETED` unattended within ~10s, with a simulated tx hash shown on the settlement page.
   Admin is also the Regulator view (`/admin` doubles as both, answering §12 step 7's open question).

   One real bug found and fixed: `ConsumerCheckout.tsx`'s `confirm()` (the "Auto-match my requirement"
   flow used by §12 step 3) created the transaction but never called `POST /payments`, unlike
   `Marketplace.tsx`'s `buy()`. Every auto-matched purchase was landing on `RESERVED` and staying there
   forever — `SettlementDetail.tsx` has no "Pay" button for a consumer, so there was no way to advance
   it. Fixed by mirroring `Marketplace.tsx`'s pattern (create transaction, then `POST /payments` with
   its id, then navigate). Verified: a 2 EC auto-match purchase now reaches `COMPLETED` automatically.

   Several NOT-fixed gaps remain, left as-is because fixing them is more than a small isolated change
   (scope note: don't redesign under a walkthrough task) — flagging for a deliberate follow-up:

   a. **Admin "Reset data" freezes the whole API for ~2–2.5 minutes.** `demo.service.ts`'s `reset()`
      calls `execSync("npx tsx prisma/seed.ts", ...)`, which blocks the single Node event loop for as
      long as the seed script takes against remote Neon — measured twice at 2m15s and 2m28s. During
      that window the API can't answer *any* request (health check included). §12 budgets 30 seconds
      for this beat; as built it can eat 10x that live on stage. Needs the seed logic invoked async
      in-process (or in a worker) rather than a blocking `execSync` shell-out.
   b. **Seed data produces far more, far smaller credit batches/listings than the demo narrative
      assumes.** The simulator ticks every simulated 5 minutes, so "Jump to 13:00" mints ~70+ tiny
      batches per prosumer (0.01–5 kWh each) instead of one clean "150 kWh → 130.5 EC" mint. §12 step 1's
      "point at the credit ID and chain hash" moment and step 2's "list 130 EC" beat don't match what's
      on screen — a seller must list one small batch at a time from a 70-row dropdown. A 500 kWh
      auto-match (step 3 as literally written) pulls from 20–40 of these tiny listings.
   c. **A many-allocation purchase can 500.** Buying at the literal 500 kWh in step 3 exceeds
      `GZ-AHM-W`'s seeded headroom (620/1000 kW load, only 380 kW free) and correctly 409s
      `GRID_CONGESTED` — expected. But a same-zone 300 kWh auto-match (still within grid capacity,
      spanning ~40 tiny listings) reproducibly 500'd twice in a row with
      `PrismaClientKnownRequestError: ... Transaction API error: Transaction not found ... obtained
      before disconnecting` from inside `createTransaction`'s interactive `$transaction`. Root cause
      looks like Neon's serverless pooler recycling/dropping the connection mid-transaction because so
      many sequential `FOR UPDATE` round-trips are needed for that many allocations — ties back to (b).
      Small purchases (2–5 kWh, 1 listing) never hit this. For the live demo, keep the requested
      quantity small or pre-consolidate listings; don't literally type 500.
   d. **After "Jump to 13:00," the meter simulator permanently breaks for the jumped meters.** Every
      ~30s thereafter the API log repeats `Simulator tick failed for meter ...: ApiError: Reading
      timestamp is too far in the future` for the same 3 meter IDs, indefinitely, until the next reset.
      Cosmetic (doesn't block the demo) but spams the log and means no further live generation happens
      for those meters post-jump.
   e. **Minor UX only**: `ProsumerSell`'s price-band hint only appears *after* a rejected submission
      (no proactive "₹2.50–₹7.00" hint before you type), and its error text push the "Publish" button
      down the page, so a fast double-click can miss the moved button. `ConsumerCheckout`'s grid-zone
      field is a raw UUID textbox, not a zone-name dropdown (`ProsumerSell` already has the pattern to
      copy from) — impractical for a presenter to type live.

   Net: the §12 script does **not** yet run start-to-finish literally as written against fresh seed
   data (mainly b/c and a), so README's checklist box for "§12 rehearsal" stays unchecked. It **does**
   work if the presenter buys/lists small, round quantities (2-10 EC) instead of the literal 130/500,
   and skips clicking "Reset data" live (pre-reset before the demo starts instead).
