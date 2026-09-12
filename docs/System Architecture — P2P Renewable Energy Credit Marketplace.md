# System Architecture

## 1. Architecture Overview

The P2P Renewable Energy Credit Marketplace is designed as a **digital trading and settlement ecosystem built on top of the existing electricity grid**.

The platform does not attempt to physically route electricity from one household to another.

Instead:

- The **existing electricity grid** handles physical electricity flow.
- **Smart meters / utility systems** provide verified generation and consumption data.
- The **platform** creates, prices, matches, and settles Energy Credits.
- The **blockchain** provides a tamper-evident transaction ledger.
- The **DISCOM integration layer** handles approved bill settlement/adjustment.

---

# 2. High-Level Architecture

```text
                         ┌───────────────────────┐
                         │       PROSUMERS       │
                         │                       │
                         │ Homes / Businesses    │
                         │ Rooftop Solar         │
                         └───────────┬───────────┘
                                     │
                              Smart Meter Data
                                     │
                                     ↓
                         ┌───────────────────────┐
                         │   UTILITY / DISCOM    │
                         │                       │
                         │ Grid + Meter + Billing│
                         └───────────┬───────────┘
                                     │
                              Meter / Billing API
                                     │
                                     ↓
┌──────────────────────────────────────────────────────────────┐
│                    P2P ENERGY PLATFORM                       │
│                                                              │
│  ┌────────────┐   ┌─────────────┐   ┌──────────────────┐    │
│  │ Auth &     │   │ Energy      │   │ Energy Credit    │    │
│  │ User       │   │ Data        │   │ Engine           │    │
│  │ Management │   │ Service     │   │                  │    │
│  └────────────┘   └──────┬──────┘   └────────┬─────────┘    │
│                           │                    │              │
│                           └─────────┬──────────┘              │
│                                     ↓                         │
│                       ┌────────────────────────┐             │
│                       │ Marketplace Engine      │             │
│                       │                        │             │
│                       │ Matching + Pricing     │             │
│                       └───────────┬────────────┘             │
│                                   │                          │
│                         ┌─────────┴─────────┐                │
│                         ↓                   ↓                │
│                  ┌──────────────┐   ┌───────────────┐        │
│                  │ PostgreSQL   │   │ Blockchain /  │        │
│                  │ Database     │   │ Smart Contract│        │
│                  └──────────────┘   └───────────────┘        │
│                                   │                           │
│                                   ↓                           │
│                         Settlement Service                   │
└───────────────────────────────────┬──────────────────────────┘
                                    │
                                    ↓
                         ┌───────────────────────┐
                         │       CONSUMERS       │
                         │                       │
                         │ Buy Energy Credits    │
                         └───────────┬───────────┘
                                     │
                                     ↓
                         ┌───────────────────────┐
                         │ DISCOM BILL SETTLEMENT │
                         │                       │
                         │ Eligible Credit       │
                         │ Adjustment            │
                         └───────────────────────┘
```

---

# 3. Two Separate Flows

The most important concept in the architecture is separating:

### Physical Energy Flow

and

### Digital Credit Flow

---

## 3.1 Physical Energy Flow

Electricity continues to flow through the existing electrical grid.

```text
Solar Prosumers
      │
      ↓
 Distribution Grid
      │
      ↓
 Consumers
```

The platform does not control or reroute individual electrons.

---

## 3.2 Digital Energy Credit Flow

The platform handles the economic/settlement representation.

```text
Verified Solar Surplus
          ↓
Energy Credit
          ↓
Marketplace
          ↓
Consumer Purchase
          ↓
Settlement
          ↓
DISCOM Bill Adjustment
```

This separation makes the architecture realistic.

---

# 4. System Components

The system consists of the following major components:

1. Client Applications
2. API Gateway
3. Authentication Service
4. User Management Service
5. Meter Data Service
6. Energy Credit Engine
7. Marketplace Service
8. Matching Engine
9. Dynamic Pricing Engine
10. Grid Management Service
11. Transaction Service
12. Payment Service
13. Settlement Service
14. Blockchain Service
15. Notification Service
16. Analytics Service
17. Utility Integration Layer
18. Database
19. Blockchain Network

---

# 5. Client Layer

The frontend provides role-specific interfaces.

```text
                  FRONTEND
                     │
       ┌─────────────┼─────────────┐
       ↓             ↓             ↓
   Prosumer       Consumer       Utility
   Dashboard     Dashboard      Dashboard
       │             │             │
       └─────────────┼─────────────┘
                     ↓
                  REST API
```

---

# 6. API Gateway

The API Gateway is the entry point for frontend requests.

Responsibilities:

- Authentication verification
- Request routing
- Rate limiting
- Request validation
- Logging
- API versioning

Example:

```text
Frontend
   ↓
API Gateway
   ↓
Correct Backend Service
```

Example:

```text
GET /api/marketplace/listings

        ↓

Marketplace Service
```

---

# 7. Authentication Service

The authentication service manages:

- Registration
- Login
- JWT generation
- Password hashing
- Role management
- Session validation

Roles:

```text
PROSUMER
CONSUMER
UTILITY
REGULATOR
ADMIN
```

---

# 8. Meter Data Service

This service receives electricity data from smart meters or utility APIs.

### Input

```text
Meter ID
User ID
Timestamp
Generation
Consumption
Import
Export
Grid Zone
```

### Production Flow

```text
Smart Meter
     ↓
DISCOM API
     ↓
Utility Integration Layer
     ↓
Meter Data Service
     ↓
Energy Credit Engine
```

### Hackathon Flow

```text
Solar Simulator
     ↓
Mock Meter API
     ↓
Meter Data Service
```

---

# 9. Energy Credit Engine

This is one of the core services of the platform.

Its responsibility is to convert verified surplus renewable energy into Energy Credits.

### Process

```text
Generation
     ↓
Consumption
     ↓
Surplus Calculation
     ↓
Eligibility Validation
     ↓
Network/Settlement Factor
     ↓
Eligible Energy
     ↓
Energy Credits
```

Example:

```text
Generation = 600 kWh
Consumption = 450 kWh

Gross Surplus = 150 kWh

Applicable Settlement Factor = 0.87

Eligible Energy = 130.5 kWh

Credits = 130.5 EC
```

The settlement factor is configurable and should be provided by the participating utility/grid rules.

---

# 10. Energy Credit Lifecycle

Every Energy Credit has a lifecycle.

```text
                 ┌──────────────┐
                 │   VERIFIED   │
                 └──────┬───────┘
                        ↓
                 ┌──────────────┐
                 │    MINTED    │
                 └──────┬───────┘
                        ↓
                 ┌──────────────┐
                 │   AVAILABLE  │
                 └──────┬───────┘
                        ↓
                 ┌──────────────┐
                 │    LISTED    │
                 └──────┬───────┘
                        ↓
                 ┌──────────────┐
                 │   RESERVED   │
                 └──────┬───────┘
                        ↓
                 ┌──────────────┐
                 │   PURCHASED  │
                 └──────┬───────┘
                        ↓
                 ┌──────────────┐
                 │   SETTLED    │
                 └──────┬───────┘
                        ↓
                 ┌──────────────┐
                 │    RETIRED   │
                 └──────────────┘
```

A retired Energy Credit cannot be traded again.

---

# 11. Marketplace Service

The marketplace manages Energy Credit listings.

### Seller

```text
Available Credits
       ↓
Create Listing
       ↓
Set Price / Accept Market Price
       ↓
Listing Published
```

### Buyer

```text
Energy Requirement
       ↓
Browse Marketplace
       ↓
Filter Eligible Credits
       ↓
Select / Auto Match
       ↓
Purchase
```

---

# 12. Matching Engine

The Matching Engine determines which prosumer should be matched with which consumer.

### Matching Inputs

```text
Buyer Demand
Seller Supply
Price
Grid Zone
Grid Capacity
Credit Availability
Credit Validity
Seller Preferences
```

### Matching Logic

A simplified priority score can be:

```text
Match Score =
    40% Price
  + 25% Grid/Location Proximity
  + 20% Availability
  + 15% Grid Condition
```

The weights can be configured.

The goal is to find an economically attractive and grid-compatible match.

---

# 13. Dynamic Pricing Engine

The Pricing Engine continuously calculates the indicative market price.

### Inputs

```text
Base Price
Supply
Demand
Grid Load
Grid Capacity
Congestion
Time
Local Market Activity
```

### Flow

```text
Supply ────────┐
Demand ────────┤
Grid Load ─────┤
Grid Capacity ─┤
Base Price ────┤
                ↓
       Pricing Engine
                ↓
       Dynamic EC Price
```

---

# 14. Grid Congestion Service

Grid congestion is represented using grid zones.

Example:

```text
ZONE A

Capacity:       1000 kW
Current Load:    850 kW
Available:       150 kW
```

The system uses this information during matching.

If a proposed transaction exceeds the allowed capacity:

```text
Trade Request
      ↓
Capacity Check
      ↓
Capacity Available?
    /       \
  YES        NO
   ↓          ↓
Proceed    Reject/Reschedule
```

This prevents the marketplace from ignoring physical grid limitations.

---

# 15. Transaction Service

The Transaction Service coordinates the complete trade.

### Transaction Flow

```text
Buyer Request
      ↓
Credit Availability Check
      ↓
Grid Eligibility Check
      ↓
Price Confirmation
      ↓
Credit Reservation
      ↓
Payment Confirmation
      ↓
Credit Transfer
      ↓
Transaction Record
      ↓
Settlement
```

---

# 16. Transaction State Machine

A transaction can have the following states:

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
SETTLEMENT_FAILED
CANCELLED
EXPIRED
```

---

# 17. Blockchain Service

The Blockchain Service connects the application backend with the smart contract.

The backend should be the primary orchestrator.

```text
Application
     ↓
Blockchain Service
     ↓
Web3 Provider
     ↓
Smart Contract
     ↓
Blockchain
```

The blockchain should not directly communicate with the frontend for sensitive business operations.

---

# 18. What Goes On Blockchain?

Only important transaction/credit lifecycle information should be recorded on-chain.

### On-chain

```text
Credit ID
Energy Quantity
Seller Wallet
Buyer Wallet
Transaction ID
Credit Status
Settlement Reference
Timestamp
```

### Off-chain

```text
User Profile
Meter Readings
Consumption Data
Generation Data
Marketplace Search Data
Pricing History
Analytics
Notifications
```

---

# 19. Why Hybrid Storage?

Putting all meter readings on blockchain would be:

- Expensive
- Slow
- Unnecessary
- Difficult to scale

Therefore:

```text
          DATA
           │
     ┌─────┴─────┐
     ↓           ↓
 PostgreSQL   Blockchain
     │           │
Business      Trust /
Data          Audit
```

This hybrid architecture provides both performance and transparency.

---

# 20. Utility Integration Layer

A dedicated integration layer prevents the platform from becoming dependent on one electricity provider.

```text
                  P2P Platform
                       │
              Utility Integration
                       │
           ┌───────────┼───────────┐
           ↓           ↓           ↓
       Utility A   Utility B   Mock Utility
```

For example:

```text
UtilityAdapter
     │
     ├── getMeterData()
     ├── getGridStatus()
     ├── getSettlementRules()
     ├── submitSettlement()
     └── getBillStatus()
```

The hackathon can use:

```text
MockUtilityAdapter
```

while the production system can implement actual utility-specific adapters.

---

# 21. Bill Settlement Architecture

After a consumer purchases Energy Credits:

```text
Consumer
   ↓
Purchase Credits
   ↓
Transaction Service
   ↓
Settlement Service
   ↓
Utility Integration Layer
   ↓
DISCOM Billing System
   ↓
Eligible Bill Adjustment
```

Example:

```text
Consumer purchases:

100 EC

Market Price:

₹4 / EC

Transaction Value:

₹400

        ↓

Settlement

        ↓

Eligible electricity amount:

100 kWh

        ↓

Consumer's participating
utility bill is adjusted
according to approved rules.
```

---

# 22. Complete Transaction Example

Consider three users.

### Prosumer 1

```text
Generation = 600 kWh
Consumption = 450 kWh

Gross surplus = 150 kWh

Eligible surplus = 130 kWh

Available = 130 EC
```

### Prosumer 2

```text
Available = 400 EC
```

### Consumer 3

```text
Required = 500 EC
```

The marketplace receives:

```text
Supply:

P1 = 130 EC
P2 = 400 EC

Total = 530 EC


Demand:

C3 = 500 EC
```

Matching Engine:

```text
P1 → 130 EC
P2 → 370 EC

Total matched = 500 EC
```

Consumer 3 receives a settlement entitlement for 500 kWh under the applicable platform/DISCOM rules.

---

# 23. Complete Digital Transaction Flow

```text
             P1
          130 EC
             │
             │
             ↓
      ┌───────────────┐
      │ Marketplace   │
      └───────┬───────┘
              │
              │ Matching
              ↓
      ┌───────────────┐
      │   Consumer 3  │
      │   Needs 500EC │
      └───────┬───────┘
              │
              ↓
       Transaction
              │
       ┌──────┴───────┐
       ↓              ↓
 Blockchain       PostgreSQL
       │              │
       └──────┬───────┘
              ↓
        Settlement
              ↓
       Utility / DISCOM
              ↓
        Bill Adjustment
```

---

# 24. Physical + Digital Ecosystem

The complete ecosystem should be visualized as two layers.

## Physical Layer

```text
       SOLAR
         ↓
    Smart Meter
         ↓
      GRID
         ↓
    Consumer
```

## Digital Layer

```text
Meter Data
    ↓
Credit Engine
    ↓
Marketplace
    ↓
Matching
    ↓
Pricing
    ↓
Transaction
    ↓
Blockchain
    ↓
Settlement
    ↓
DISCOM Billing
```

Together:

```text
             PHYSICAL LAYER
                  │
                  │ Meter Data
                  ↓
          ┌─────────────────┐
          │ DIGITAL PLATFORM│
          └────────┬────────┘
                   │
          Credit + Payment
                   ↓
             SETTLEMENT
                   │
                   ↓
               DISCOM
```

---

# 25. Real-Time Architecture

The system uses WebSockets/Socket.IO for real-time events.

```text
Meter Data Update
       ↓
Backend
       ↓
Pricing Engine
       ↓
Marketplace
       ↓
WebSocket
       ↓
Frontend
```

Example:

```text
Solar Supply ↑
     ↓
Marketplace Supply ↑
     ↓
Demand/Supply Ratio ↓
     ↓
Price changes
     ↓
All connected dashboards update
```

---

# 26. Notification Architecture

```text
Event
  ↓
Notification Service
  ↓
WebSocket / Email
  ↓
User
```

Events:

```text
Credit Sold
Credit Purchased
Price Changed
Trade Matched
Payment Completed
Settlement Completed
Bill Adjusted
```

---

# 27. Analytics Architecture

Analytics data is derived from:

```text
Meter Data
Transaction Data
Credit Data
Pricing Data
Grid Data
Settlement Data
```

The Analytics Service generates:

- Energy traded
- Renewable energy utilized
- User savings
- Prosumer earnings
- Average market price
- Grid-zone activity
- Transaction volume

---

# 28. Security Architecture

```text
User
 ↓
HTTPS
 ↓
API Gateway
 ↓
JWT Authentication
 ↓
Role Authorization
 ↓
Service
 ↓
Database / Blockchain
```

Security controls:

- HTTPS
- JWT
- RBAC
- Password hashing
- Input validation
- Rate limiting
- API authentication
- Audit logging
- Blockchain transaction verification

---

# 29. Failure Handling

The platform must not assume every external system is always available.

### Meter API Failure

```text
Meter API unavailable
        ↓
Do not issue new credits
        ↓
Mark reading as pending
        ↓
Retry
```

### Payment Failure

```text
Payment failed
     ↓
Cancel reservation
     ↓
Return credits to seller
```

### Blockchain Failure

```text
Blockchain unavailable
        ↓
Transaction marked
"Blockchain Pending"
        ↓
Retry asynchronously
```

### DISCOM Settlement Failure

```text
Settlement failed
       ↓
Transaction remains pending
       ↓
Retry / manual review
       ↓
Do not retire credit until
settlement is confirmed
```

---

# 30. Deployment Architecture

```text
                    INTERNET
                        │
                        ↓
                 ┌────────────┐
                 │   Vercel   │
                 │  Frontend  │
                 └─────┬──────┘
                       │
                    HTTPS
                       │
                       ↓
              ┌─────────────────┐
              │ Backend Server  │
              │ Node + Express  │
              └───────┬─────────┘
                      │
          ┌───────────┼────────────┐
          ↓           ↓            ↓
    PostgreSQL    Blockchain    WebSocket
          │           │            │
          ↓           ↓            ↓
       Database   Smart Contract  Clients
                      │
                      ↓
                Utility APIs
```

---

# 31. Hackathon Architecture

For the SIH prototype, external dependencies can be simulated.

```text
                   FRONTEND
                      │
                      ↓
                  BACKEND
                      │
       ┌──────────────┼──────────────┐
       ↓              ↓              ↓
 Meter Simulator   Pricing       Marketplace
       │            Engine           │
       ↓              ↓              ↓
 Energy Credit ← Matching Engine → Transaction
       │                             │
       └─────────────┬───────────────┘
                     ↓
               Smart Contract
                     │
                     ↓
              Mock DISCOM API
                     │
                     ↓
              Simulated Bill
```

This allows the team to demonstrate the entire ecosystem without depending on real utility infrastructure.

---

# 32. Scalability Architecture

The system should initially be implemented as a modular monolith for rapid hackathon development.

```text
                 Backend
                    │
       ┌────────────┼────────────┐
       ↓            ↓            ↓
    Energy      Marketplace   Settlement
    Module         Module       Module
```

As the platform grows, modules can be separated into services:

```text
API Gateway
     │
 ┌───┼────┬──────┬────────┐
 ↓   ↓    ↓      ↓        ↓
Auth Energy Market Pricing Settlement
     │
     └───────────────┐
                     ↓
                  Message
                   Queue
```

Potential future technologies:

- Redis
- Kafka
- RabbitMQ
- Kubernetes

These are not required for the hackathon MVP.

---

# 33. Architectural Principles

The platform follows these principles:

### 1. Grid-first

The existing electricity grid remains the physical infrastructure.

### 2. Meter-verified

Energy Credits should originate from verified meter data.

### 3. No double spending

The same surplus energy cannot generate multiple active credits.

### 4. Hybrid storage

Use PostgreSQL for application data and blockchain for trusted transaction records.

### 5. Utility interoperability

The platform should integrate with multiple utilities through adapters.

### 6. Privacy by design

Consumers should not receive unnecessary personal information about prosumers.

### 7. Grid-aware trading

Trading should respect grid capacity and congestion.

### 8. Regulatory compatibility

Bill settlement and Energy Credit treatment must follow applicable utility and regulatory rules.

---

# 34. Final Architecture Summary

```text
                         ┌──────────────┐
                         │   PROSUMER   │
                         │ Solar + Meter│
                         └──────┬───────┘
                                │
                           Meter Data
                                │
                                ↓
                    ┌──────────────────────┐
                    │ Utility Integration  │
                    │       Layer          │
                    └──────────┬───────────┘
                               ↓
                    ┌──────────────────────┐
                    │   Energy Credit      │
                    │       Engine          │
                    └──────────┬───────────┘
                               ↓
              ┌────────────────────────────────┐
              │        P2P MARKETPLACE         │
              │                                │
              │  Matching + Dynamic Pricing   │
              │  Grid Congestion Management   │
              └───────────────┬────────────────┘
                              ↓
                    ┌───────────────────┐
                    │    Transaction    │
                    │     Service       │
                    └─────────┬─────────┘
                              │
                  ┌───────────┴───────────┐
                  ↓                       ↓
           ┌──────────────┐       ┌──────────────┐
           │ PostgreSQL   │       │  Blockchain  │
           │              │       │ Smart Contract│
           └──────────────┘       └───────┬──────┘
                                          │
                                          ↓
                               ┌──────────────────┐
                               │ Settlement Layer │
                               └────────┬─────────┘
                                        ↓
                               ┌──────────────────┐
                               │  DISCOM / Utility│
                               │ Billing System   │
                               └────────┬─────────┘
                                        ↓
                                  Consumer Bill
                                   Adjustment
```

## Core Architectural Statement

> **The platform does not replace the electricity grid. It creates a digital, grid-aware marketplace that converts verified surplus renewable generation into Energy Credits, matches them with eligible consumers, dynamically determines their value, records transactions transparently, and communicates approved settlements to participating utilities for bill adjustment.**