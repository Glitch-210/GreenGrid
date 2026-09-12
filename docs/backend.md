# Backend Architecture — P2P Renewable Energy Credit Marketplace

## 1. Backend Overview

The backend is responsible for connecting the frontend, database, blockchain, marketplace, pricing engine, meter system, and DISCOM settlement system.

### Technology

```text
Node.js
Express.js
TypeScript
PostgreSQL
Prisma ORM
JWT Authentication
Zod Validation
Socket.IO
ethers.js
Solidity Smart Contract
```

### Backend Responsibilities

```text
Authentication
User Management
Meter Data Processing
Surplus Calculation
Energy Credit Creation
Marketplace Management
P2P Matching
Dynamic Pricing
Grid Congestion Management
Transactions
Payments
Blockchain Integration
DISCOM Settlement
Notifications
Audit Logging
```

---

# 2. Backend Architecture

```text
                    FRONTEND
                       |
                       ↓
                ┌─────────────┐
                │ Express API │
                └──────┬──────┘
                       |
        ┌──────────────┼──────────────┐
        ↓              ↓              ↓
   Auth Service   User Service   Meter Service
        |              |              |
        └──────────────┼──────────────┘
                       ↓
                Credit Engine
                       |
          ┌────────────┼────────────┐
          ↓            ↓            ↓
     Marketplace   Matching     Pricing
          |            |            |
          └────────────┼────────────┘
                       ↓
                  Transaction
                       |
              ┌────────┴────────┐
              ↓                 ↓
         Blockchain         Payment
              |                 |
              └────────┬────────┘
                       ↓
                DISCOM Settlement
                       |
                       ↓
                  PostgreSQL
```

---

# 3. Project Folder Structure

```text
backend/
│
├── src/
│   │
│   ├── config/
│   │   ├── env.ts
│   │   └── database.ts
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   ├── meter.controller.ts
│   │   ├── credit.controller.ts
│   │   ├── marketplace.controller.ts
│   │   ├── transaction.controller.ts
│   │   ├── payment.controller.ts
│   │   ├── settlement.controller.ts
│   │   └── grid.controller.ts
│   │
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── meter.service.ts
│   │   ├── credit.service.ts
│   │   ├── marketplace.service.ts
│   │   ├── matching.service.ts
│   │   ├── pricing.service.ts
│   │   ├── transaction.service.ts
│   │   ├── payment.service.ts
│   │   ├── blockchain.service.ts
│   │   └── settlement.service.ts
│   │
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── meter.routes.ts
│   │   ├── credit.routes.ts
│   │   ├── marketplace.routes.ts
│   │   ├── transaction.routes.ts
│   │   ├── payment.routes.ts
│   │   ├── settlement.routes.ts
│   │   └── grid.routes.ts
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── role.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── validation.middleware.ts
│   │
│   ├── validators/
│   │   ├── auth.validator.ts
│   │   ├── credit.validator.ts
│   │   ├── listing.validator.ts
│   │   └── transaction.validator.ts
│   │
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── calculations.ts
│   │   └── response.ts
│   │
│   ├── sockets/
│   │   └── socket.ts
│   │
│   ├── app.ts
│   └── server.ts
│
├── prisma/
│   └── schema.prisma
│
├── contracts/
│   └── EnergyCredit.sol
│
├── tests/
│
├── .env
├── package.json
└── tsconfig.json
```

---

# 4. API Design

Base URL:

```text
/api/v1
```

---

## Authentication APIs

### Register

```http
POST /api/v1/auth/register
```

Request:

```json
{
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "phone": "9876543210",
  "password": "password",
  "role": "PROSUMER"
}
```

Response:

```json
{
  "success": true,
  "message": "User registered successfully"
}
```

---

### Login

```http
POST /api/v1/auth/login
```

Response:

```json
{
  "success": true,
  "token": "JWT_TOKEN",
  "user": {
    "id": "user-id",
    "role": "PROSUMER"
  }
}
```

---

# 5. User APIs

### Get Profile

```http
GET /api/v1/users/me
```

### Update Profile

```http
PUT /api/v1/users/me
```

### Get Dashboard

```http
GET /api/v1/users/dashboard
```

Dashboard response can contain:

```json
{
  "generation": 600,
  "consumption": 450,
  "surplus": 150,
  "availableCredits": 130,
  "earnings": 520
}
```

---

# 6. Meter APIs

### Register Meter

```http
POST /api/v1/meters
```

### Get Meter

```http
GET /api/v1/meters/:id
```

### Get Meter Readings

```http
GET /api/v1/meters/:id/readings
```

### Submit Meter Reading

For the hackathon, this endpoint can simulate the smart-meter API.

```http
POST /api/v1/meters/:id/readings
```

Example:

```json
{
  "generationKwh": 600,
  "consumptionKwh": 450,
  "timestamp": "2026-09-12T10:00:00Z"
}
```

---

# 7. Surplus Energy Calculation

The backend calculates verified surplus energy.

```text
Surplus = Generation - Consumption
```

Example:

```text
Generation = 600 kWh
Consumption = 450 kWh

Surplus = 150 kWh
```

### Rules

```text
If generation < consumption:
    surplus = 0

If generation = consumption:
    surplus = 0

If generation > consumption:
    surplus = generation - consumption
```

The backend must never create credits from unverified meter data.

---

# 8. Energy Credit APIs

### Get Available Credits

```http
GET /api/v1/credits
```

### Get Credit Details

```http
GET /api/v1/credits/:id
```

### Generate Credits

```http
POST /api/v1/credits/generate
```

Example:

```json
{
  "meterReadingId": "reading-id"
}
```

Backend flow:

```text
Meter Reading
      ↓
Verify Reading
      ↓
Calculate Surplus
      ↓
Check Existing Credits
      ↓
Create EC
      ↓
Store in PostgreSQL
      ↓
Record Blockchain Transaction
      ↓
Return Credit ID
```

---

# 9. Credit Safety Logic

The credit engine must enforce:

```text
Verified surplus = 150 kWh

Maximum credits = 150 EC
```

It must reject:

```text
200 EC
```

because only 150 kWh was verified.

### Double-Creation Protection

Every meter reading gets a unique identifier.

Before generating credits:

```text
Check:
Has credits already been generated for this reading?
```

If yes:

```text
Reject request
```

This prevents the same energy from being converted into credits multiple times.

---

# 10. Marketplace APIs

### Create Listing

```http
POST /api/v1/marketplace/list
```

Request:

```json
{
  "creditId": "credit-id",
  "quantityKwh": 100,
  "pricePerKwh": 4.20
}
```

Backend checks:

```text
Credit exists
        ↓
Credit belongs to seller
        ↓
Credit status = AVAILABLE
        ↓
Quantity <= available quantity
        ↓
Lock/reserve listed quantity
        ↓
Create listing
```

---

### Get Marketplace

```http
GET /api/v1/marketplace
```

Optional filters:

```text
gridZone
minPrice
maxPrice
quantity
sort
```

Example:

```http
GET /api/v1/marketplace?gridZone=GZ01&sort=price
```

---

### Cancel Listing

```http
DELETE /api/v1/marketplace/:id
```

Only the seller who created the listing can cancel it.

---

# 11. Matching Engine

The matching engine connects consumers with suitable prosumers.

### Matching API

```http
POST /api/v1/matching/find
```

Request:

```json
{
  "quantityKwh": 500,
  "gridZoneId": "GZ01",
  "maxPrice": 5
}
```

The engine searches active listings.

### Matching Factors

```text
Price              → 40%
Grid proximity     → 25%
Energy availability→ 20%
Grid condition     → 15%
```

A simplified score can be:

```text
Match Score =
0.40 × Price Score
+ 0.25 × Grid Score
+ 0.20 × Availability Score
+ 0.15 × Grid Condition Score
```

The weights can be changed later.

---

# 12. Partial Matching

A consumer does not necessarily need to be fulfilled by one seller.

Example:

```text
Consumer requirement = 500 EC

Seller A = 130 EC
Seller B = 250 EC
Seller C = 120 EC
```

The matching engine can create:

```text
130 + 250 + 120 = 500 EC
```

The backend creates multiple match records linked to the same transaction/order.

---

# 13. Dynamic Pricing Engine

The pricing engine calculates the current marketplace price.

A simplified model:

```text
Final Price =
Base Price
+ Demand Adjustment
- Supply Adjustment
+ Congestion Adjustment
```

Example:

```text
Base Price = ₹4.00

High Demand Adjustment = +₹0.50
High Supply Adjustment = -₹0.20
Congestion Adjustment = +₹0.30

Final Price = ₹4.60 / EC
```

The production implementation should use configurable price floors, ceilings, and DISCOM/regulatory rules.

---

# 14. Grid Congestion Logic

The backend continuously evaluates grid conditions.

Example:

```text
Grid Capacity = 1000 kW
Current Load = 850 kW

Available Capacity = 150 kW
```

If a proposed trade exceeds available capacity:

```text
Trade
  ↓
Check Grid Capacity
  ↓
Capacity Available?
   /        \
 YES         NO
  |           |
Proceed    Reject / Delay /
           Redirect
```

This prevents the digital marketplace from ignoring physical grid constraints.

---

# 15. Transaction Flow

The complete transaction follows:

```text
PENDING
   ↓
MATCHED
   ↓
RESERVED
   ↓
PAYMENT_PENDING
   ↓
PAID
   ↓
CREDIT_TRANSFERRED
   ↓
SETTLEMENT_PENDING
   ↓
SETTLED
   ↓
COMPLETED
```

Failure states:

```text
PAYMENT_FAILED
BLOCKCHAIN_FAILED
SETTLEMENT_FAILED
CANCELLED
```

---

# 16. Transaction API

### Create Purchase

```http
POST /api/v1/transactions
```

Request:

```json
{
  "matches": [
    {
      "listingId": "listing-1",
      "quantityKwh": 130
    },
    {
      "listingId": "listing-2",
      "quantityKwh": 370
    }
  ]
}
```

Backend:

```text
Validate buyer
      ↓
Validate listings
      ↓
Check credit availability
      ↓
Check grid capacity
      ↓
Reserve credits
      ↓
Calculate final price
      ↓
Create transaction
```

---

# 17. Payment Service

For the MVP, payment can be simulated.

### Payment API

```http
POST /api/v1/payments
```

Request:

```json
{
  "transactionId": "transaction-id",
  "method": "MOCK"
}
```

Response:

```json
{
  "success": true,
  "paymentStatus": "SUCCESS",
  "reference": "PAY-123456"
}
```

In the production version, this can be connected to a real payment provider.

---

# 18. Blockchain Service

The blockchain service communicates with the smart contract using **ethers.js**.

### Responsibilities

```text
Mint Energy Credit
Transfer Energy Credit
Verify Ownership
Record Trade
Retire Credit
Get Transaction Status
```

Example:

```text
PostgreSQL
     |
     ↓
Blockchain Service
     |
     ↓
ethers.js
     |
     ↓
Smart Contract
     |
     ↓
Blockchain
```

The backend stores the resulting transaction hash.

Example:

```text
0x8a7f...91bc
```

---

# 19. Smart Contract Interaction

Example backend functions:

```typescript
mintCredit(
    creditId,
    quantity,
    sellerWallet
)

transferCredit(
    creditId,
    buyerWallet
)

retireCredit(
    creditId
)
```

The blockchain should not contain sensitive user information.

Store only the minimum required transaction/credit data.

---

# 20. DISCOM Settlement Service

The backend communicates with the DISCOM through a utility adapter.

### Interface

```typescript
interface UtilityAdapter {

  getMeterData(meterId: string);

  getGridStatus(gridZoneId: string);

  getTariff();

  getSettlementRules();

  submitSettlement(transactionId: string);

  getSettlementStatus(referenceId: string);

}
```

For the hackathon:

```text
Mock Utility Adapter
```

will simulate the DISCOM.

Later:

```text
Mock Utility Adapter
        ↓
Torrent Power Adapter
        ↓
Other DISCOM Adapters
```

This keeps the backend utility-agnostic.

---

# 21. Settlement Flow

```text
Transaction Completed
        ↓
Prepare Settlement
        ↓
Send to DISCOM API
        ↓
DISCOM Validates
        ↓
Settlement Approved?
      /       \
    YES        NO
     |          |
Bill Adjust   Retry / Failure
     |
Credit Retired
```

Example:

```text
Purchased Energy = 100 EC
Eligible adjustment = ₹420

Consumer's bill:
₹2,500
      ↓
₹420 adjustment
      ↓
₹2,080
```

The actual settlement amount must follow the participating DISCOM's approved rules.

---

# 22. Real-Time Communication

Use **Socket.IO** for real-time updates.

Events:

```text
price:update
marketplace:update
grid:update
trade:matched
payment:updated
settlement:updated
notification:new
```

Example:

```text
Grid condition changes
        ↓
Backend updates GridStatus
        ↓
Pricing Engine recalculates
        ↓
Socket.IO emits price:update
        ↓
Frontend updates price instantly
```

---

# 23. Authentication Middleware

Every protected API uses JWT authentication.

```text
Request
   ↓
Authorization Header
   ↓
JWT Verification
   ↓
Valid?
 /   \
YES   NO
 |     |
Next   401
```

Example header:

```text
Authorization: Bearer <JWT_TOKEN>
```

---

# 24. Role-Based Access Control

### PROSUMER

Can:

```text
View meter data
View credits
Create listings
Cancel listings
View earnings
View transactions
```

### CONSUMER

Can:

```text
View marketplace
Search EC
Purchase EC
View transactions
View bill settlement
```

### UTILITY

Can:

```text
View grid status
View trades
Process settlements
View aggregate energy data
```

### REGULATOR

Can:

```text
View market statistics
View audit logs
View transaction history
Monitor compliance
```

### ADMIN

Can:

```text
Manage users
Manage grid zones
Configure pricing
Manage system settings
Monitor failures
```

---

# 25. Validation

Use **Zod** for API request validation.

Example:

```typescript
const listingSchema = z.object({
    creditId: z.string().uuid(),
    quantityKwh: z.number().positive(),
    pricePerKwh: z.number().positive()
});
```

Invalid requests should return:

```json
{
  "success": false,
  "message": "Invalid request data"
}
```

---

# 26. Error Handling

Centralized Express error middleware should handle:

```text
Validation Errors
Authentication Errors
Authorization Errors
Database Errors
Payment Errors
Blockchain Errors
Utility API Errors
```

Standard response:

```json
{
  "success": false,
  "message": "Unable to process transaction",
  "errorCode": "TRANSACTION_FAILED"
}
```

Never expose internal stack traces to users.

---

# 27. Database Transaction Safety

Critical operations must be atomic.

Example:

```text
Reserve Credits
      +
Create Match
      +
Create Transaction
```

should either:

```text
ALL SUCCESS
```

or:

```text
ALL ROLLBACK
```

This prevents situations where credits are locked but no transaction exists.

---

# 28. Idempotency

Important APIs should support idempotency.

For example, if a payment request is accidentally sent twice:

```text
Payment Request
     ↓
Check Idempotency Key
     ↓
Already processed?
   /        \
 YES         NO
  |           |
Return       Process
existing
result
```

This prevents duplicate payments and duplicate transactions.

---

# 29. Background Jobs

Some operations should run asynchronously.

Examples:

```text
Meter data synchronization
Grid status updates
Price recalculation
Blockchain confirmation
DISCOM settlement polling
Notifications
```

For the hackathon MVP, these can initially be implemented using simple scheduled jobs rather than introducing Redis/Kafka.

---

# 30. Security Requirements

The backend must:

```text
Hash passwords using bcrypt
Use JWT authentication
Validate all input
Use HTTPS in production
Protect private blockchain keys
Never expose .env values
Use role-based authorization
Prevent double spending
Prevent duplicate credit creation
Rate-limit sensitive APIs
Avoid storing unnecessary PII
```

Blockchain private keys must **never** be stored in frontend code.

---

# 31. Important Environment Variables

```env
PORT=5000

DATABASE_URL=postgresql://...

JWT_SECRET=...

BLOCKCHAIN_RPC_URL=...

BLOCKCHAIN_PRIVATE_KEY=...

SMART_CONTRACT_ADDRESS=...

UTILITY_API_URL=...

UTILITY_API_KEY=...

PAYMENT_API_KEY=...
```

`.env` must be included in `.gitignore`.

---

# 32. MVP Mock Services

Since actual DISCOM and smart-meter APIs may not be available during the hackathon, create mock services.

### Mock Meter

```text
GET /mock/meter/:id
```

Returns:

```json
{
  "generationKwh": 600,
  "consumptionKwh": 450,
  "exportKwh": 150
}
```

### Mock DISCOM

```text
POST /mock/discom/settlement
```

Returns:

```json
{
  "reference": "SET-12345",
  "status": "APPROVED",
  "billAdjustment": 420
}
```

This allows the complete workflow to be demonstrated without requiring real utility integration.

---

# 33. Complete Backend Flow

```text
User Registration
       ↓
Meter Registration
       ↓
Meter Data
       ↓
Surplus Calculation
       ↓
Energy Credit Creation
       ↓
Credit Verification
       ↓
Marketplace Listing
       ↓
Consumer Searches Marketplace
       ↓
Matching Engine
       ↓
Dynamic Pricing
       ↓
Grid Capacity Check
       ↓
Credit Reservation
       ↓
Payment
       ↓
Blockchain Transfer
       ↓
DISCOM Settlement
       ↓
Bill Adjustment
       ↓
Credit Retirement
       ↓
Transaction Completed
```

---

# 34. Recommended API Priority for Hackathon

Build APIs in this order:

### Phase 1 — Core

```text
POST /auth/register
POST /auth/login
GET  /users/me
```

### Phase 2 — Energy

```text
POST /meters/:id/readings
GET  /meters/:id/readings
POST /credits/generate
GET  /credits
```

### Phase 3 — Marketplace

```text
POST /marketplace/list
GET  /marketplace
DELETE /marketplace/:id
```

### Phase 4 — Trading

```text
POST /matching/find
POST /transactions
GET  /transactions/:id
```

### Phase 5 — Settlement

```text
POST /payments
POST /settlements
GET  /settlements/:id
```

### Phase 6 — Demo Enhancements

```text
Socket.IO
Blockchain
Grid congestion
Dynamic pricing
Notifications
Analytics
```

---

# 35. Backend MVP Success Criteria

The backend is considered MVP-complete when this scenario works:

```text
Prosumer generates 600 kWh
          ↓
Consumes 450 kWh
          ↓
150 kWh surplus detected
          ↓
150 EC generated
          ↓
130 EC listed
          ↓
Consumer requests 100 EC
          ↓
Matching engine finds seller
          ↓
Price calculated
          ↓
Grid capacity checked
          ↓
100 EC reserved
          ↓
Payment succeeds
          ↓
Blockchain transfer recorded
          ↓
DISCOM settlement simulated
          ↓
Consumer bill adjusted
          ↓
100 EC marked SETTLED/RETIRED
```

If this complete lifecycle works, the backend demonstrates the core value proposition of the platform.