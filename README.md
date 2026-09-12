# wattshare — P2P Renewable Energy Credit Marketplace

Hackathon project (`hackout'26`): verified surplus solar → EC minted → listed → matched → priced → grid-checked → paid → on-chain transfer → DISCOM settlement → bill adjusted → EC retired.

See `IMPLEMENTATION_PLAN.md` for the full design (data model, module specs, API surface, demo script).

## Architecture

Monorepo (npm workspaces):

- `apps/api` — Express + TypeScript modular monolith, Prisma/Postgres, Socket.IO
- `apps/web` — React + Vite + TypeScript + Tailwind
- `packages/contracts` — Hardhat, `EnergyCredit.sol` (Polygon Amoy testnet)
- `packages/shared` — shared TS types, enums, Zod schemas

## Setup

```bash
npm install
cp apps/api/.env.example apps/api/.env   # fill in real values (a working .env is already provisioned for the hackout Neon project)
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

- API: http://localhost:5000 (health check: `GET /api/v1/health`)
- Web: http://localhost:5173

## Demo logins (seeded, password `demo1234`)

| Email | Role |
|---|---|
| prosumer1@demo.in | PROSUMER (Solar-Pro-101, GZ-AHM-W, 6kW) |
| prosumer2@demo.in | PROSUMER (Solar-Pro-102, GZ-AHM-W, 12kW) |
| prosumer3@demo.in | PROSUMER (Solar-Pro-103, GZ-AHM-E, 4kW) |
| prosumer4@demo.in | PROSUMER (Solar-Pro-104, GZ-AHM-W, 8kW — FLAGGED meter, fraud demo) |
| consumer1@demo.in | CONSUMER (main demo buyer, GZ-AHM-W) |
| consumer2@demo.in / consumer3@demo.in | CONSUMER |
| utility@demo.in | UTILITY |
| regulator@demo.in | REGULATOR |
| admin@demo.in | ADMIN |

## Safety principles

1. **Decimal everywhere** — `Decimal(18,4)` in Postgres, `decimal.js` in TS. Never `number` for kWh or ₹.
2. **Atomic reservation** — row-level locks (`SELECT ... FOR UPDATE`) inside serializable transactions prevent double-spend of the same energy credit.
3. **Chain is the audit trail, not the critical path** — trades complete off-chain first; blockchain writes are async, fire-and-forget with retry, and never block the demo.
4. **Credits are only retired after DISCOM settlement confirms**, never on submit.
5. **Every credit satisfies** `available + reserved + sold + retired == quantity` at all times — enforced in code and checked by an invariant script.

## Definition of done

- [ ] `npm i && npm run dev` boots API + web from a clean clone
- [ ] `npx prisma migrate deploy && npm run db:seed` produces the seeded demo world
- [ ] Double-spend integration test passes
- [ ] Every credit satisfies the balance invariant above
- [ ] No settled credit exceeds its purchased quantity; no credit retired before `SETTLED`
