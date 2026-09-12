# Technology Stack

## 1. Technology Stack Overview

The platform will use a modern full-stack architecture with:

- **Frontend:** React.js + TypeScript
- **Backend:** Node.js + Express.js
- **Database:** PostgreSQL
- **Real-Time Communication:** Socket.IO / WebSockets
- **Blockchain:** Polygon / Ethereum-compatible network
- **Smart Contracts:** Solidity
- **Authentication:** JWT
- **API Communication:** RESTful APIs
- **Charts & Analytics:** Recharts
- **Maps / Location:** Google Maps API or OpenStreetMap
- **Deployment:** Vercel + Render/Railway
- **Containerization:** Docker
- **Version Control:** Git + GitHub

---

# 2. Frontend

## Technology

**React.js + TypeScript**

### Why React?

React is suitable for the project because the platform contains multiple dynamic dashboards:

- Prosumer dashboard
- Consumer dashboard
- Marketplace
- Utility dashboard
- Admin/Regulator dashboard

React allows individual components to update without reloading the entire application.

### TypeScript

TypeScript will be used to:

- Reduce runtime errors.
- Define clear data models.
- Improve maintainability.
- Make API integration safer.

### UI Library

Recommended:

**Tailwind CSS**

Optional component library:

**shadcn/ui**

This allows rapid development of a professional dashboard during the hackathon.

---

# 3. Frontend Structure

```text
frontend/
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── layouts/
│   ├── hooks/
│   ├── services/
│   ├── types/
│   ├── utils/
│   └── App.tsx
│
├── public/
└── package.json
```

### Main Pages

```text
/login
/register

/prosumer/dashboard
/prosumer/credits
/prosumer/sell

/consumer/dashboard
/consumer/marketplace
/consumer/purchases

/utility/dashboard
/admin/dashboard
```

---

# 4. Backend

## Technology

**Node.js + Express.js + TypeScript**

### Why Node.js?

The platform requires frequent API communication for:

- Meter data
- Marketplace updates
- Credit generation
- Price updates
- Transactions
- Notifications
- Settlement status

Node.js is well suited for I/O-heavy applications and real-time communication.

### Express.js

Express will provide the REST API layer between:

```text
Frontend
    ↓
REST API
    ↓
Backend
    ↓
Database / Blockchain / Utility APIs
```

---

# 5. Backend Responsibilities

The backend will handle:

### User Management

- Registration
- Login
- Authentication
- Role management

### Energy Management

- Generation data
- Consumption data
- Surplus calculation
- Energy Credit generation

### Marketplace

- Credit listing
- Credit purchase
- Order management
- Buyer-seller matching

### Pricing

- Supply calculation
- Demand calculation
- Grid congestion
- Dynamic pricing

### Settlement

- Transaction creation
- Payment status
- Credit transfer
- DISCOM bill adjustment records

### Blockchain

- Smart contract interaction
- Transaction hash generation
- Blockchain verification

---

# 6. Database

## Technology

**PostgreSQL**

PostgreSQL will store structured application data.

### Why PostgreSQL?

The platform contains strongly related entities:

```text
User
  ↓
Meter
  ↓
Energy Reading
  ↓
Energy Credit
  ↓
Marketplace Order
  ↓
Transaction
  ↓
Settlement
```

A relational database provides:

- Referential integrity
- Transactions
- Strong consistency
- Complex queries
- Reliable financial/energy records

---

# 7. ORM

Recommended:

**Prisma ORM**

Prisma will be used for:

- Database schema management
- Type-safe queries
- Migrations
- Relationships
- Transaction handling

Architecture:

```text
Node.js
   ↓
Prisma
   ↓
PostgreSQL
```

---

# 8. RESTful APIs

The backend will expose REST APIs.

## Authentication

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

## Energy

```text
GET  /api/energy/generation
GET  /api/energy/consumption
GET  /api/energy/surplus
```

## Energy Credits

```text
GET  /api/credits
POST /api/credits/mint
POST /api/credits/list
GET  /api/credits/:id
```

## Marketplace

```text
GET  /api/marketplace/listings
POST /api/marketplace/list
POST /api/marketplace/buy
GET  /api/marketplace/orders
```

## Pricing

```text
GET /api/pricing/current
GET /api/pricing/history
```

## Transactions

```text
GET /api/transactions
GET /api/transactions/:id
```

## Utility

```text
GET  /api/utility/grid-status
GET  /api/utility/settlements
POST /api/utility/meter-data
```

---

# 9. Real-Time Layer

## Technology

**Socket.IO / WebSockets**

Real-time communication will be used for:

- Live energy generation
- Live marketplace listings
- Dynamic price updates
- Grid load updates
- Trade notifications
- Settlement notifications

Example:

```text
Solar Generation Changes
        ↓
Backend
        ↓
Pricing Engine
        ↓
WebSocket
        ↓
User Dashboard
```

The dashboard can therefore update without requiring a page refresh.

---

# 10. Energy Credit Engine

The Energy Credit Engine is responsible for converting verified surplus energy into eligible Energy Credits.

### Input

```text
Generation
Consumption
Meter Status
Timestamp
Grid Zone
Loss Factor
```

### Processing

```text
Generation
    -
Consumption
    ↓
Gross Surplus
    ↓
Apply applicable settlement/network factor
    ↓
Eligible Surplus
    ↓
Energy Credits
```

Example:

```text
Generation = 600 kWh
Consumption = 450 kWh

Gross Surplus = 150 kWh

Applicable factor = 0.87

Eligible Energy = 130.5 kWh

Energy Credits = 130.5 EC
```

The actual factor should come from the participating utility/grid configuration.

---

# 11. Dynamic Pricing Engine

The pricing engine determines the current indicative P2P price.

### Inputs

```text
Base Utility Price
Supply
Demand
Grid Load
Grid Capacity
Congestion
Time
Local Market Activity
```

### Conceptual Formula

```text
Dynamic Price =
Base Price
+ Demand Adjustment
- Supply Adjustment
+ Congestion Adjustment
```

A more practical normalized model can be:

```text
Price =
Base Price ×
(1 + Demand Factor - Supply Factor + Congestion Factor)
```

The exact coefficients can be configured for the prototype.

---

# 12. Matching Engine

The matching engine connects consumers with eligible prosumers.

### Matching Criteria

Priority can be given to:

1. Price
2. Distance / grid zone
3. Grid availability
4. Energy availability
5. Credit validity
6. Seller preferences

Example:

```text
Consumer requires 100 EC

Seller A
50 EC @ ₹4.20

Seller B
30 EC @ ₹4.10

Seller C
40 EC @ ₹4.30

Matching Engine
       ↓
A + B + C
       ↓
100 EC fulfilled
```

---

# 13. Blockchain

## Recommended Technology

**Polygon-compatible Ethereum network**

The blockchain should primarily be used for:

- Transaction transparency
- Credit lifecycle tracking
- Tamper-evident records
- Smart-contract-based settlement

The blockchain should **not** store every meter reading.

---

# 14. On-Chain vs Off-Chain Architecture

## Off-Chain

PostgreSQL stores:

```text
User profiles
Meter readings
Generation data
Consumption data
Marketplace data
Pricing data
Analytics
Settlement metadata
```

## On-Chain

Blockchain stores:

```text
Credit ID
Energy quantity
Seller wallet
Buyer wallet
Transaction ID
Settlement status
Timestamp
```

Architecture:

```text
             Backend
                │
        ┌───────┴────────┐
        ↓                ↓
   PostgreSQL       Blockchain
   Off-chain         On-chain
```

This reduces blockchain cost and improves performance.

---

# 15. Smart Contracts

## Language

**Solidity**

The smart contract can manage the Energy Credit lifecycle.

### Main functions

```text
mintCredit()
listCredit()
buyCredit()
transferCredit()
retireCredit()
getCreditStatus()
```

### Simplified lifecycle

```text
Verified Surplus
       ↓
Mint Credit
       ↓
Available
       ↓
Listed
       ↓
Purchased
       ↓
Transferred
       ↓
Settled / Retired
```

---

# 16. Double-Spending Prevention

A critical requirement is preventing the same surplus energy from being sold multiple times.

The system will maintain:

```text
Verified Energy
       ↓
Credit Issuance
       ↓
Credit Balance
       ↓
Credit Lock
       ↓
Sale
       ↓
Credit Transfer
       ↓
Retirement
```

Example:

```text
Verified Surplus = 100 EC

Minted = 100 EC

Sold = 40 EC

Remaining = 60 EC
```

The user cannot sell more than the available balance.

---

# 17. Smart Meter / Utility Integration

In the production system, the platform should integrate with participating utility/DISCOM APIs.

Possible data:

```text
Meter ID
Timestamp
Import Energy
Export Energy
Generation
Consumption
Grid Zone
Meter Status
```

For the hackathon:

```text
Real Smart Meter
       ↓
      MOCK
       ↓
Meter API Simulator
       ↓
Backend
```

This allows us to demonstrate the complete system without requiring access to proprietary utility infrastructure.

---

# 18. Payment Integration

For the prototype, payment can be simulated.

For production, possible options include:

- UPI
- Payment gateway
- Utility billing settlement
- Bank settlement

The payment layer should be separated from the Energy Credit layer.

```text
Energy Credit
      +
Payment
      ↓
Settlement
```

---

# 19. Utility/DISCOM Integration

The production architecture should expose a dedicated integration layer.

```text
Your Platform
      ↓
Utility Integration API
      ↓
DISCOM
      ↓
Meter + Billing System
```

This abstraction allows support for multiple electricity providers without changing the marketplace core.

Example:

```text
Utility Adapter
├── TorrentPowerAdapter
├── UtilityBAdapter
├── UtilityCAdapter
└── MockUtilityAdapter
```

For the hackathon, the **MockUtilityAdapter** can simulate Torrent Power-like meter and billing operations.

---

# 20. Location and Grid-Zone Services

The platform can use:

- Google Maps API
- OpenStreetMap
- Utility grid-zone data

Location is primarily used for:

- Finding nearby eligible sellers.
- Determining trading zones.
- Applying grid constraints.
- Calculating approximate proximity.
- Improving matching.

The production system should preferably use **grid-zone identifiers** rather than exposing exact household locations to other users.

---

# 21. Authentication and Security

## Authentication

**JWT-based authentication**

Example:

```text
Login
 ↓
JWT Token
 ↓
Authenticated API Requests
```

## Authorization

Role-based access control:

```text
PROSUMER
CONSUMER
UTILITY
REGULATOR
ADMIN
```

Each role receives only the permissions required for its operations.

---

# 22. API Security

The backend should implement:

- JWT authentication
- Role-based authorization
- HTTPS
- Input validation
- Rate limiting
- API request logging
- Secure password hashing
- CORS configuration
- Environment variables for secrets

Recommended libraries:

```text
bcrypt
jsonwebtoken
zod
helmet
express-rate-limit
```

---

# 23. Data Validation

**Zod** can be used for request validation.

Example:

```text
POST /api/credits/list

Validation:
- creditId required
- quantity > 0
- price >= 0
- credit must belong to seller
- credit must be available
```

Invalid requests should never reach the transaction layer.

---

# 24. Notifications

Notifications can be implemented using:

- WebSockets
- Email
- In-app notifications

Events include:

```text
Credit Sold
Credit Purchased
Price Changed
Settlement Completed
Bill Adjustment Completed
Transaction Failed
```

For the hackathon, in-app real-time notifications are sufficient.

---

# 25. Analytics

Recommended:

**Recharts**

Dashboards can show:

- Solar generation
- Energy consumption
- Energy traded
- Price trends
- Consumer savings
- Prosumer earnings
- Grid load
- Renewable-energy utilization

Example:

```text
Energy Generation
      ↕
Energy Consumption
      ↕
Surplus
      ↕
Credits Traded
      ↕
Savings
```

---

# 26. Deployment

## Frontend

Recommended:

**Vercel**

```text
React + TypeScript
       ↓
Vercel
```

## Backend

Recommended:

**Render / Railway**

```text
Node.js + Express
       ↓
Render / Railway
```

## Database

Recommended:

**Managed PostgreSQL**

Examples:

- Neon
- Supabase
- Railway PostgreSQL

## Blockchain

Use a test network for the hackathon.

```text
Frontend
    ↓
Backend
    ↓
Smart Contract
    ↓
Test Blockchain
```

---

# 27. Development Environment

Required tools:

```text
Node.js
npm
Git
GitHub
VS Code
PostgreSQL
Docker
MetaMask / compatible wallet
```

Optional:

```text
Postman
Docker Desktop
Prisma Studio
```

---

# 28. Recommended Final Stack

| Layer | Technology |
|---|---|
| Frontend | React.js |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Backend | Node.js |
| API Framework | Express.js |
| Database | PostgreSQL |
| ORM | Prisma |
| Real-time | Socket.IO |
| Authentication | JWT |
| Validation | Zod |
| Blockchain | Polygon-compatible EVM network |
| Smart Contract | Solidity |
| Web3 Integration | ethers.js |
| Charts | Recharts |
| Maps | Google Maps / OpenStreetMap |
| API Testing | Postman |
| Containerization | Docker |
| Version Control | Git + GitHub |
| Frontend Deployment | Vercel |
| Backend Deployment | Render / Railway |
| Database Hosting | Neon / Supabase / Railway |

---

# 29. Hackathon Architecture Principle

The most important architectural principle is:

> **Use blockchain only where trust and auditability are valuable, use PostgreSQL for application data, and use the existing grid/DISCOM infrastructure for physical electricity delivery.**

This keeps the system:

- Fast
- Affordable
- Scalable
- Easier to develop
- Easier to explain
- More realistic for utility integration

---

# 30. Technology Strategy for SIH

The hackathon prototype should use a **simulation-first architecture**.

```text
             ┌─────────────────┐
             │ Solar Simulator │
             └────────┬────────┘
                      ↓
             ┌─────────────────┐
             │ Meter Simulator │
             └────────┬────────┘
                      ↓
             ┌─────────────────┐
             │    Backend      │
             └────────┬────────┘
                      ↓
       ┌──────────────┼──────────────┐
       ↓              ↓              ↓
 Pricing Engine   Matching Engine   Credit Engine
       │              │              │
       └──────────────┼──────────────┘
                      ↓
             ┌─────────────────┐
             │  Marketplace    │
             └────────┬────────┘
                      ↓
             ┌─────────────────┐
             │ Smart Contract  │
             └────────┬────────┘
                      ↓
             ┌─────────────────┐
             │ Mock DISCOM API │
             └────────┬────────┘
                      ↓
             Consumer Bill
             Adjustment Demo
```

This gives the judges the impression of a **production-ready ecosystem**, while keeping the actual hackathon implementation achievable.