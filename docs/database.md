# Database Design — P2P Renewable Energy Credit Marketplace

## 1. Database Overview

The platform will use **PostgreSQL** as the primary database with **Prisma ORM**.

The database stores:

- User and role information
- Prosumer/consumer profiles
- Smart meter readings
- Solar generation and consumption data
- Energy Credits (EC)
- Marketplace listings
- Matching and pricing information
- Transactions
- Payments
- DISCOM bill settlement
- Grid zones and congestion data
- Blockchain transaction references
- Notifications and audit logs

### Database Principle

The database stores the **application and settlement state**, while the blockchain stores important **tamper-evident transaction/credit records**.

---

# 2. Main Entities

```text
USER
 │
 ├── METER
 │      │
 │      └── METER_READING
 │
 ├── ENERGY_CREDIT
 │      │
 │      └── MARKETPLACE_LISTING
 │
 ├── TRANSACTION
 │      │
 │      ├── PAYMENT
 │      │
 │      └── SETTLEMENT
 │
 └── NOTIFICATION

GRID_ZONE
 │
 ├── METER
 └── GRID_STATUS
```

---

# 3. Users Table

Stores all platform users.

### User

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | VARCHAR | User name |
| email | VARCHAR | Unique email |
| phone | VARCHAR | Phone number |
| passwordHash | VARCHAR | Hashed password |
| role | ENUM | PROSUMER, CONSUMER, UTILITY, REGULATOR, ADMIN |
| status | ENUM | ACTIVE, SUSPENDED, DELETED |
| createdAt | TIMESTAMP | Account creation time |
| updatedAt | TIMESTAMP | Last update |

---

# 4. Meter Table

Stores eligible smart-meter information.

### Meter

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| meterNumber | VARCHAR | Unique meter identifier |
| userId | UUID | Owner of meter |
| gridZoneId | UUID | Connected grid zone |
| meterType | ENUM | SOLAR, CONSUMER, BIDIRECTIONAL |
| status | ENUM | ACTIVE, OFFLINE, SUSPENDED |
| installedAt | TIMESTAMP | Installation date |
| createdAt | TIMESTAMP | Record creation time |

**Note:** The MVP can use a simulated meter API instead of a real smart meter.

---

# 5. Meter Reading Table

Stores generation and consumption readings received from the meter.

### MeterReading

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| meterId | UUID | Related meter |
| timestamp | TIMESTAMP | Reading time |
| generationKwh | DECIMAL | Solar generation |
| consumptionKwh | DECIMAL | Energy consumed |
| importKwh | DECIMAL | Energy imported from grid |
| exportKwh | DECIMAL | Energy exported to grid |
| verified | BOOLEAN | Whether reading is verified |
| createdAt | TIMESTAMP | Record creation time |

### Surplus Calculation

```text
Surplus Energy = Generation - Consumption
```

Example:

```text
Generation = 600 kWh
Consumption = 450 kWh

Surplus = 150 kWh
```

The credit engine can then create:

```text
150 verified kWh → 150 Energy Credits
```

Any DISCOM-defined technical/network adjustment should be applied according to configured settlement rules rather than hardcoded.

---

# 6. Grid Zone Table

Represents the distribution-grid area used for localized matching.

### GridZone

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| zoneCode | VARCHAR | Unique grid-zone code |
| name | VARCHAR | Zone name |
| capacityKw | DECIMAL | Maximum capacity |
| currentLoadKw | DECIMAL | Current load |
| status | ENUM | NORMAL, CONGESTED, OUTAGE |
| createdAt | TIMESTAMP | Creation time |
| updatedAt | TIMESTAMP | Last update |

### Available Capacity

```text
Available Capacity = Capacity - Current Load
```

Example:

```text
Capacity = 1000 kW
Current Load = 850 kW

Available Capacity = 150 kW
```

---

# 7. Energy Credit Table

Energy Credits are the platform's digital accounting and settlement units.

### EnergyCredit

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| creditId | VARCHAR | Public unique credit ID |
| ownerId | UUID | Current owner |
| sourceMeterId | UUID | Meter that generated the energy |
| quantityKwh | DECIMAL | Energy represented by credits |
| status | ENUM | VERIFIED, MINTED, AVAILABLE, LISTED, RESERVED, PURCHASED, SETTLED, RETIRED |
| blockchainTxHash | VARCHAR | Blockchain transaction reference |
| createdAt | TIMESTAMP | Creation time |
| updatedAt | TIMESTAMP | Last update |

### Credit Rule

```text
1 Energy Credit (EC) = 1 kWh
of verified surplus renewable energy
```

Energy Credits are **not cryptocurrency, carbon credits, or RECs**.

---

# 8. Marketplace Listing Table

Stores ECs offered for sale.

### MarketplaceListing

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| sellerId | UUID | Prosumer selling EC |
| creditId | UUID | Credits being sold |
| quantityKwh | DECIMAL | Quantity listed |
| pricePerKwh | DECIMAL | Asking price |
| gridZoneId | UUID | Seller's grid zone |
| status | ENUM | ACTIVE, RESERVED, SOLD, CANCELLED, EXPIRED |
| createdAt | TIMESTAMP | Listing creation |
| expiresAt | TIMESTAMP | Listing expiry |

Example:

```text
Seller: Prosumer 1
Available: 130 EC
Price: ₹4.20 / EC
Zone: GZ-01
```

---

# 9. Match Table

Stores the result of the matching engine.

### EnergyMatch

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| buyerId | UUID | Consumer |
| sellerId | UUID | Prosumer |
| listingId | UUID | Marketplace listing |
| quantityKwh | DECIMAL | Matched energy |
| pricePerKwh | DECIMAL | Final matched price |
| score | DECIMAL | Matching score |
| gridZoneId | UUID | Relevant grid zone |
| status | ENUM | MATCHED, RESERVED, COMPLETED, CANCELLED |
| createdAt | TIMESTAMP | Match time |

### Matching Factors

The matching engine can consider:

```text
Price
Grid Zone
Grid Capacity
Available Energy
Credit Validity
Seller Preferences
```

---

# 10. Transaction Table

Records the complete P2P trade.

### Transaction

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| transactionId | VARCHAR | Public transaction ID |
| buyerId | UUID | Consumer |
| sellerId | UUID | Prosumer |
| quantityKwh | DECIMAL | Energy traded |
| pricePerKwh | DECIMAL | Final price |
| totalAmount | DECIMAL | Total transaction value |
| platformFee | DECIMAL | Platform fee |
| status | ENUM | PENDING, MATCHED, RESERVED, PAID, CREDIT_TRANSFERRED, SETTLEMENT_PENDING, SETTLED, COMPLETED, FAILED |
| blockchainTxHash | VARCHAR | Blockchain reference |
| createdAt | TIMESTAMP | Transaction creation |
| completedAt | TIMESTAMP | Completion time |

---

# 11. Payment Table

Stores payment information.

### Payment

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| transactionId | UUID | Related transaction |
| amount | DECIMAL | Payment amount |
| paymentReference | VARCHAR | Payment provider/reference ID |
| status | ENUM | PENDING, SUCCESS, FAILED, REFUNDED |
| paymentMethod | VARCHAR | UPI, CARD, WALLET, MOCK |
| createdAt | TIMESTAMP | Payment time |

For the hackathon MVP, payment can be simulated.

---

# 12. Settlement Table

Stores the interaction with the DISCOM billing system.

### Settlement

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| transactionId | UUID | Related transaction |
| consumerId | UUID | Consumer |
| discomReference | VARCHAR | DISCOM settlement reference |
| quantityKwh | DECIMAL | Eligible settled energy |
| billAdjustment | DECIMAL | Amount adjusted in bill |
| status | ENUM | PENDING, SUBMITTED, SETTLED, FAILED |
| failureReason | TEXT | Reason if settlement fails |
| createdAt | TIMESTAMP | Settlement creation |
| settledAt | TIMESTAMP | Settlement completion |

Example:

```text
Consumer purchases: 100 EC
Eligible bill adjustment: ₹420

DISCOM Bill
Before: ₹2,500
Adjustment: ₹420
After: ₹2,080
```

The exact adjustment formula is controlled by the participating DISCOM's rules.

---

# 13. Grid Status Table

Stores real-time or simulated grid conditions.

### GridStatus

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| gridZoneId | UUID | Grid zone |
| loadKw | DECIMAL | Current load |
| generationKw | DECIMAL | Current renewable generation |
| availableCapacityKw | DECIMAL | Remaining capacity |
| congestionLevel | ENUM | LOW, MEDIUM, HIGH |
| timestamp | TIMESTAMP | Status time |

This data is used by the pricing and matching engines.

---

# 14. Pricing Table

Stores calculated marketplace prices.

### EnergyPrice

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| gridZoneId | UUID | Grid zone |
| basePrice | DECIMAL | Base energy price |
| demandFactor | DECIMAL | Demand adjustment |
| supplyFactor | DECIMAL | Supply adjustment |
| congestionFactor | DECIMAL | Grid adjustment |
| finalPrice | DECIMAL | Calculated price |
| timestamp | TIMESTAMP | Price timestamp |

Example:

```text
Final Price =
Base Price
+ Demand Adjustment
- Supply Adjustment
+ Congestion Adjustment
```

Price floors and ceilings should be configurable.

---

# 15. Notification Table

Stores user notifications.

### Notification

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| userId | UUID | Recipient |
| type | VARCHAR | Notification type |
| title | VARCHAR | Notification title |
| message | TEXT | Notification message |
| isRead | BOOLEAN | Read status |
| createdAt | TIMESTAMP | Creation time |

Examples:

```text
Your Energy Credits were sold.
Your payment was successful.
Your bill settlement is complete.
Grid congestion detected in your zone.
```

---

# 16. Audit Log Table

Important actions should be recorded for transparency and debugging.

### AuditLog

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| userId | UUID | Actor |
| action | VARCHAR | Action performed |
| entityType | VARCHAR | Affected entity |
| entityId | UUID | Affected record |
| metadata | JSONB | Additional information |
| timestamp | TIMESTAMP | Action time |

Examples:

```text
CREDIT_CREATED
CREDIT_LISTED
TRADE_MATCHED
PAYMENT_COMPLETED
SETTLEMENT_SUBMITTED
SETTLEMENT_COMPLETED
```

---

# 17. Important Relationships

```text
User 1 ──────── N Meter

Meter 1 ─────── N MeterReading

GridZone 1 ──── N Meter

Meter 1 ─────── N EnergyCredit

User 1 ──────── N MarketplaceListing

EnergyCredit 1 ─ 1 MarketplaceListing

User 1 ──────── N Transaction (Buyer)

User 1 ──────── N Transaction (Seller)

Transaction 1 ─ 1 Payment

Transaction 1 ─ 1 Settlement

GridZone 1 ──── N GridStatus

GridZone 1 ──── N EnergyPrice

User 1 ──────── N Notification

User 1 ──────── N AuditLog
```

---

# 18. Database Constraints

The following rules are critical:

### No Negative Energy

```text
generationKwh >= 0
consumptionKwh >= 0
quantityKwh > 0
```

### No Double Credit Creation

```text
Verified Energy ≤ Generated Surplus
```

### No Double Spending

A credit cannot be simultaneously:

```text
AVAILABLE + RESERVED
```

### Atomic Transactions

Credit reservation and transaction creation should happen inside a database transaction.

### Unique Identifiers

The following should be unique:

```text
User.email
Meter.meterNumber
EnergyCredit.creditId
Transaction.transactionId
MarketplaceListing.id
```

### Decimal Precision

Energy and monetary values should use **DECIMAL/NUMERIC**, not floating-point types, to avoid financial calculation errors.

---

# 19. Hybrid Database + Blockchain Model

The platform should not store every piece of data on-chain.

### PostgreSQL

Stores:

```text
Users
Meter readings
Marketplace listings
Prices
Grid status
Payments
Settlement status
Analytics
Notifications
```

### Blockchain

Stores important proof/transaction information:

```text
Credit ID
Credit quantity
Seller
Buyer
Ownership transfer
Transaction hash
Timestamp
Credit status
```

This keeps the system scalable while maintaining transaction auditability.

---

# 20. Example End-to-End Data Flow

```text
Smart Meter
     ↓
MeterReading
     ↓
Surplus Calculation
     ↓
EnergyCredit
     ↓
MarketplaceListing
     ↓
Matching Engine
     ↓
Transaction
     ↓
Payment
     ↓
Blockchain Credit Transfer
     ↓
DISCOM Settlement
     ↓
Bill Adjustment
     ↓
Credit Retired
```

### Example

```text
Generation = 600 kWh
Consumption = 450 kWh

Surplus = 150 kWh

150 EC created
        ↓
130 EC listed for sale
        ↓
Consumer purchases 100 EC
        ↓
100 EC transferred
        ↓
Payment completed
        ↓
DISCOM settlement submitted
        ↓
Eligible bill adjustment applied
        ↓
100 EC marked SETTLED/RETIRED
```

---

# 21. MVP Database

For the overnight hackathon, the minimum required tables are:

```text
User
Meter
MeterReading
GridZone
EnergyCredit
MarketplaceListing
EnergyMatch
Transaction
Payment
Settlement
GridStatus
EnergyPrice
```

The following can be added if time permits:

```text
Notification
AuditLog
```

This database structure is sufficient to demonstrate the complete **verified surplus → Energy Credit → marketplace → matching → payment → blockchain → DISCOM bill settlement** lifecycle.