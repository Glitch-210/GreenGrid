# Dependencies

## 1. Overview

This document defines the software libraries, frameworks, services, development tools, and external integrations required to build the P2P Renewable Energy Credit Marketplace.

The dependency strategy is divided into:

1. Core dependencies — required for the hackathon MVP.
2. Integration dependencies — used to simulate or connect external systems.
3. Blockchain dependencies — required for Energy Credit transactions.
4. Development dependencies — used during development and testing.
5. Optional dependencies — intended for future production expansion.

---

# 2. Core Technology Dependencies

| Category | Technology | Purpose |
|---|---|---|
| Frontend | React.js | User interface |
| Language | TypeScript | Type-safe development |
| Styling | Tailwind CSS | UI styling |
| UI Components | shadcn/ui | Reusable UI components |
| Backend | Node.js | Server runtime |
| API | Express.js | REST API |
| Database | PostgreSQL | Persistent data storage |
| ORM | Prisma | Database access |
| Real-time | Socket.IO | Live updates |
| Authentication | JWT | User authentication |
| Validation | Zod | API validation |
| Blockchain | EVM-compatible network | Transaction ledger |
| Smart Contract | Solidity | Energy Credit contract |
| Web3 | ethers.js | Blockchain interaction |
| Charts | Recharts | Dashboard analytics |
| Maps | Google Maps / OpenStreetMap | Location and proximity |

---

# 3. Frontend Dependencies

## React

```text
react
react-dom
```

Purpose:

- Build user interfaces.
- Create dashboards.
- Manage marketplace screens.

---

## TypeScript

```text
typescript
```

Purpose:

- Static type checking.
- API type definitions.
- Better code maintainability.

---

## Routing

Recommended:

```text
react-router-dom
```

Purpose:

```text
/login
/register
/prosumer/dashboard
/consumer/dashboard
/marketplace
/utility/dashboard
```

---

## Tailwind CSS

```text
tailwindcss
```

Purpose:

- Rapid UI development.
- Responsive layouts.
- Consistent styling.

---

## shadcn/ui

Recommended components:

- Button
- Card
- Dialog
- Table
- Tabs
- Badge
- Dropdown
- Form
- Toast
- Progress
- Select

Purpose:

Create a consistent professional dashboard without building every UI component manually.

---

# 4. Frontend State Management

For the hackathon MVP, avoid unnecessary complexity.

Recommended options:

### Local/React State

Use:

```text
useState
useContext
useReducer
```

for simple state.

### Server State

Recommended:

```text
@tanstack/react-query
```

Purpose:

- API requests.
- Caching.
- Refetching.
- Loading/error states.
- Marketplace updates.

---

# 5. Frontend API Communication

Recommended:

```text
axios
```

or native:

```text
fetch()
```

For a small MVP, native `fetch()` is sufficient.

If the application contains many API endpoints, Axios can simplify request handling.

---

# 6. Frontend Charts

Recommended:

```text
recharts
```

Used for:

- Solar generation
- Consumption
- Surplus
- Credit prices
- Energy traded
- Consumer savings
- Prosumer earnings
- Grid load

Example dashboard:

```text
Generation
Consumption
Surplus
Price
Grid Load
```

---

# 7. Backend Dependencies

## Node.js

Node.js is the runtime environment for the backend.

Recommended current LTS release should be used.

---

## Express.js

```text
express
```

Purpose:

- REST APIs
- Routing
- Middleware
- Authentication
- Error handling

---

## TypeScript

```text
typescript
tsx
```

Purpose:

- Type-safe backend development.
- Development execution.
- Better maintainability.

---

# 8. Authentication Dependencies

## JSON Web Token

```text
jsonwebtoken
```

Purpose:

Generate authentication tokens.

Flow:

```text
Login
 ↓
JWT
 ↓
API Request
 ↓
JWT Verification
 ↓
Authorized Request
```

---

## Password Hashing

Recommended:

```text
bcrypt
```

Purpose:

Securely hash user passwords.

Passwords must never be stored as plain text.

---

# 9. API Validation

Recommended:

```text
zod
```

Used to validate:

- Registration requests.
- Marketplace listings.
- Energy Credit quantities.
- Prices.
- Purchase requests.
- Meter readings.

Example validation rules:

```text
Energy Credit quantity > 0
Price >= 0
Meter reading >= 0
```

---

# 10. Database Dependencies

## PostgreSQL

PostgreSQL is the primary relational database.

It stores:

- Users
- Roles
- Meters
- Energy readings
- Energy Credits
- Listings
- Orders
- Transactions
- Payments
- Settlements
- Grid zones
- Notifications

---

## Prisma

Recommended:

```text
prisma
@prisma/client
```

Purpose:

- Database schema.
- Migrations.
- Type-safe queries.
- Relationships.
- Transactions.

Architecture:

```text
Backend
   ↓
Prisma
   ↓
PostgreSQL
```

---

# 11. Real-Time Dependencies

## Socket.IO

```text
socket.io
socket.io-client
```

Purpose:

Real-time communication between backend and frontend.

Events:

```text
energy.updated
price.updated
credit.listed
trade.matched
trade.completed
payment.completed
settlement.completed
bill.updated
```

Example:

```text
Meter Update
     ↓
Backend
     ↓
Pricing Engine
     ↓
Socket.IO
     ↓
Dashboard
```

---

# 12. Blockchain Dependencies

## Solidity

Used to develop the Energy Credit smart contract.

The smart contract handles:

```text
Mint
List
Transfer
Retire
Verify
```

---

## ethers.js

Recommended:

```text
ethers
```

Purpose:

- Connect backend to blockchain.
- Call smart contract functions.
- Read transaction status.
- Retrieve transaction hashes.

Architecture:

```text
Backend
   ↓
ethers.js
   ↓
Blockchain RPC
   ↓
Smart Contract
```

---

# 13. Smart Contract Development

Recommended development framework:

```text
Hardhat
```

or:

```text
Foundry
```

For a JavaScript/TypeScript team, **Hardhat** is easier to integrate into the existing stack.

Use it for:

- Contract compilation.
- Testing.
- Local blockchain.
- Deployment.
- Contract interaction.

---

# 14. Blockchain Network

For the hackathon, use an **EVM-compatible test network** rather than a production blockchain.

Requirements:

- Low transaction cost.
- EVM compatibility.
- Easy wallet integration.
- Testnet availability.

The exact production network can be selected later based on utility/regulatory requirements.

---

# 15. Wallet Dependency

For blockchain demonstrations:

```text
MetaMask
```

can be used as the user wallet.

However, normal consumers should not be required to understand cryptocurrency.

The production platform should abstract blockchain complexity from users.

Conceptually:

```text
User
 ↓
Normal Web App
 ↓
Backend
 ↓
Blockchain
```

rather than forcing every user to manually interact with blockchain transactions.

---

# 16. Meter Data Dependencies

## Production

The production system will require:

- Smart meter APIs.
- Utility APIs.
- Meter authentication.
- Billing APIs.
- Grid-status APIs.

The exact APIs depend on the participating DISCOM.

---

## Hackathon

Real utility APIs are not required.

Use:

```text
Mock Meter API
```

to generate:

```text
Generation
Consumption
Import
Export
Timestamp
Meter ID
Grid Zone
```

Example:

```text
GET /mock/meter/MTR001
```

Response:

```json
{
  "meterId": "MTR001",
  "generation": 600,
  "consumption": 450,
  "timestamp": "2026-09-12T12:00:00Z"
}
```

---

# 17. Utility/DISCOM Dependencies

A utility integration adapter should abstract external utility systems.

Example:

```text
UtilityAdapter
│
├── getMeterData()
├── getGridStatus()
├── getTariff()
├── getSettlementRules()
├── submitSettlement()
└── getBillStatus()
```

For the hackathon:

```text
MockUtilityAdapter
```

should implement these functions.

This allows the prototype to demonstrate Torrent Power-like integration without claiming access to private production APIs.

---

# 18. Payment Dependencies

For the MVP, payment can be simulated.

Example:

```text
POST /api/payment/create
POST /api/payment/confirm
```

The mock payment service can return:

```text
SUCCESS
FAILED
PENDING
```

For production, a regulated payment provider/gateway can be integrated.

Potential future integration:

```text
UPI
Payment Gateway
Bank Settlement
Utility Billing
```

---

# 19. Location Dependencies

Location services can be used for:

- Nearby prosumer discovery.
- Grid-zone identification.
- Distance estimation.
- Matching optimization.

Possible technologies:

```text
Google Maps API
```

or:

```text
OpenStreetMap
```

For the hackathon, grid zones can simply be represented by identifiers:

```text
ZONE-A
ZONE-B
ZONE-C
```

This avoids unnecessary map/API complexity.

---

# 20. Environment Variables

Sensitive configuration must not be hard-coded.

Recommended `.env` variables:

```text
DATABASE_URL=

JWT_SECRET=

BLOCKCHAIN_RPC_URL=
BLOCKCHAIN_PRIVATE_KEY=
SMART_CONTRACT_ADDRESS=

UTILITY_API_URL=
UTILITY_API_KEY=

PAYMENT_API_URL=
PAYMENT_API_KEY=

MAPS_API_KEY=
```

The `.env` file must never be committed to GitHub.

---

# 21. Development Dependencies

Recommended:

```text
eslint
prettier
typescript
tsx
nodemon
```

Purpose:

### ESLint

Code quality and error detection.

### Prettier

Consistent code formatting.

### tsx

Running TypeScript during development.

### Nodemon

Automatic backend restart during development.

---

# 22. API Testing

Recommended:

```text
Postman
```

or:

```text
Insomnia
```

API testing should cover:

```text
Authentication
Energy
Credits
Marketplace
Pricing
Matching
Transactions
Payments
Settlement
Utility
```

---

# 23. Testing Dependencies

## Backend

Recommended:

```text
Jest
Supertest
```

Test:

- Authentication.
- Credit generation.
- Credit balance.
- Marketplace transactions.
- Matching.
- Pricing.
- Settlement.

---

## Smart Contract

Hardhat testing can be used for:

```text
Credit creation
Credit transfer
Double-spending prevention
Unauthorized operations
Credit retirement
```

---

# 24. Docker

Recommended:

```text
Docker
Docker Compose
```

Docker can run:

```text
Frontend
Backend
PostgreSQL
Redis (optional)
```

For the hackathon, Docker is optional if local development is faster without it.

---

# 25. Caching / Performance

Not required for the initial MVP.

Future option:

```text
Redis
```

Possible uses:

- Current market price.
- Marketplace cache.
- Grid status.
- Session data.
- Rate limiting.
- Frequently accessed data.

Architecture:

```text
Backend
   ↓
Redis
   ↓
PostgreSQL
```

---

# 26. Message Queue

Not required for the hackathon.

For production-scale deployment, a message queue can handle asynchronous tasks.

Potential technologies:

```text
RabbitMQ
Kafka
AWS SQS
```

Useful for:

- Blockchain confirmation.
- Utility settlement.
- Notifications.
- Meter data processing.
- Retry operations.

---

# 27. Monitoring

For production:

```text
Sentry
Prometheus
Grafana
```

can be used for:

- Application errors.
- API performance.
- System health.
- Transaction failures.
- External API failures.

Not required for the hackathon MVP.

---

# 28. Deployment Dependencies

## Frontend

```text
Vercel
```

## Backend

```text
Render
```

or:

```text
Railway
```

## PostgreSQL

```text
Neon
```

or:

```text
Supabase
```

or:

```text
Railway PostgreSQL
```

## Blockchain

```text
EVM-compatible test network
```

---

# 29. Minimum Installation for Hackathon

The team should initially install only:

```text
Node.js
npm
Git
VS Code
PostgreSQL
```

Then create the application dependencies.

### Frontend

```text
React
TypeScript
React Router
Tailwind CSS
TanStack Query
Recharts
Socket.IO Client
```

### Backend

```text
Node.js
Express
TypeScript
Prisma
PostgreSQL
JWT
bcrypt
Zod
Socket.IO
```

### Blockchain

```text
Solidity
Hardhat
ethers.js
MetaMask
```

This is enough to build the MVP.

---

# 30. Dependency Priority

## 🔴 Must Have

```text
React
TypeScript
Tailwind
Node.js
Express
PostgreSQL
Prisma
JWT
Zod
Socket.IO
Solidity
ethers.js
Hardhat
```

## 🟡 Useful

```text
TanStack Query
Recharts
Axios
Postman
Docker
MetaMask
```

## 🟢 Future

```text
Redis
Kafka
RabbitMQ
Prometheus
Grafana
Sentry
Kubernetes
AI/ML forecasting
```

---

# 31. Recommended Dependency Philosophy

The project should follow:

> **"Build the MVP with the minimum number of dependencies required to demonstrate the complete ecosystem."**

Do not add technologies simply because they sound impressive.

For example:

```text
❌ Kubernetes
❌ Kafka
❌ Microservices
❌ Complex AI models
❌ Multiple blockchains
```

are unnecessary for the overnight prototype.

Instead:

```text
React
   ↓
Node + Express
   ↓
PostgreSQL
   ↓
Pricing + Matching
   ↓
Smart Contract
   ↓
Mock DISCOM
```

is enough to demonstrate the complete concept.

---

# 32. Final Dependency Architecture

```text
                         FRONTEND
                            │
       ┌────────────────────┼───────────────────┐
       │                    │                   │
    React              Tailwind            Recharts
       │                    │                   │
       └────────────────────┼───────────────────┘
                            ↓
                       REST / WebSocket
                            ↓
                         BACKEND
                            │
        ┌───────────────────┼────────────────────┐
        ↓                   ↓                    ↓
     Express             Prisma              Socket.IO
        │                   │                    │
        ↓                   ↓                    ↓
   Business Logic      PostgreSQL          Real-time Events
        │
   ┌────┼───────────┬────────────┐
   ↓    ↓           ↓            ↓
Credit Pricing   Matching   Settlement
Engine  Engine    Engine       Engine
   │                              │
   ↓                              ↓
Blockchain                    Utility API
   │                              │
   ↓                              ↓
Smart Contract                DISCOM
```

---

# 33. Final Recommendation

For the SIH hackathon, the recommended stack is:

> **React + TypeScript + Tailwind CSS → Node.js + Express + TypeScript → PostgreSQL + Prisma → Socket.IO → Solidity + Hardhat + ethers.js → Mock Smart Meter + Mock DISCOM APIs.**

This stack provides enough technical depth to demonstrate:

- Real-time energy data
- Energy Credit creation
- P2P marketplace
- Dynamic pricing
- Smart matching
- Blockchain settlement
- Utility integration
- Consumer bill adjustment

without creating unnecessary infrastructure complexity.