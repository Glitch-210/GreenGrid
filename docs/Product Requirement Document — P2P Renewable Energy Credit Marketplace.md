# Product Requirement Document (PRD)

## 1. Product Overview

### Product Name
**P2P Renewable Energy Credit Marketplace**

### Product Vision

Build a digital peer-to-peer renewable energy marketplace that allows households, commercial users, and other eligible solar prosumers to monetize their verified surplus solar generation by converting it into tradable **Energy Credits**.

Consumers can purchase these Energy Credits through the platform and receive the corresponding eligible benefit/adjustment through the participating electricity distributor's billing system.

The platform does not replace the existing electricity grid. Instead, it acts as a **digital marketplace, matching, pricing, verification, and settlement layer on top of the existing electricity infrastructure.**

---

## 2. Problem Statement

Rooftop solar prosumers frequently generate more electricity than they consume during high-generation periods.

Currently, surplus electricity is generally exported to the grid according to applicable utility/net-metering/feed-in arrangements. The economic value received by the prosumer may be lower than the retail electricity price paid by consumers.

At the same time, nearby consumers continue purchasing electricity through the conventional electricity supply system.

This creates an opportunity to:

- Improve the economic value of surplus renewable generation.
- Give consumers access to potentially lower-cost renewable energy.
- Encourage local consumption of renewable generation.
- Improve utilization of distributed renewable energy.
- Provide transparent digital tracking and settlement of P2P energy transactions.

---

## 3. Proposed Solution

The platform creates a marketplace between:

- **Prosumers** — users who generate renewable electricity and have surplus energy.
- **Consumers** — users who need electricity and want to purchase eligible renewable Energy Credits.
- **DISCOMs / Utilities** — electricity distribution companies responsible for the physical grid and participating in meter/billing settlement.
- **Regulators** — entities that may monitor transactions, pricing, renewable-energy usage, and compliance.

### Basic Flow

```text
Solar Generation
       ↓
Smart Meter / Meter Data
       ↓
Surplus Energy Verification
       ↓
Energy Credit Creation
       ↓
P2P Marketplace
       ↓
Buyer-Seller Matching
       ↓
Dynamic Pricing
       ↓
Credit Purchase
       ↓
Settlement
       ↓
DISCOM Bill Adjustment
```

---

## 4. Energy Credit Model

For the platform MVP:

> **1 Energy Credit (EC) represents 1 kWh of verified surplus renewable energy eligible for P2P settlement.**

Example:

```text
Solar Generation       = 600 kWh
Household Consumption   = 450 kWh
Gross Surplus           = 150 kWh
```

After applying the applicable network/settlement loss factor:

```text
Eligible Surplus
       ↓
Energy Credit Engine
       ↓
Eligible Energy Credits
```

The applicable loss factor should be determined by the participating utility/grid configuration rather than being arbitrarily fixed by the application.

### Important distinction

Energy Credits are platform settlement/accounting units.

They are not intended to be represented as:

- Cryptocurrency
- Carbon Credits
- Renewable Energy Certificates (RECs)

unless future regulatory frameworks explicitly allow such treatment.

---

## 5. Target Users

### 5.1 Prosumer

A household, business, building, or eligible entity with renewable generation.

Key actions:

- View generation.
- View consumption.
- View surplus.
- Receive Energy Credits.
- List Energy Credits for sale.
- Set preferred selling price.
- Accept automatic matching.
- View earnings.
- View transaction history.

---

### 5.2 Consumer

A user who consumes electricity and wants to purchase eligible renewable Energy Credits.

Key actions:

- View energy requirement.
- Browse available Energy Credits.
- Compare prices.
- View nearby/eligible sellers.
- Purchase Energy Credits.
- View savings.
- Track purchased credits.
- View bill settlement status.

---

### 5.3 Utility / DISCOM

The electricity distributor participating in the ecosystem.

Key actions:

- Provide/verify meter data.
- Define settlement rules.
- Provide applicable network-loss factors.
- Define eligible trading zones/capacity.
- Receive settlement information.
- Apply eligible bill adjustments.
- Monitor energy transactions.

---

### 5.4 Regulator

Potential regulatory/monitoring user.

Key actions:

- Monitor total P2P energy traded.
- Monitor pricing.
- Monitor renewable energy usage.
- Review transaction records.
- Detect abnormal trading behavior.
- Monitor market activity and compliance.

---

# 6. Core Features

## 6.1 User Registration and Verification

Users can register as:

- Prosumer
- Consumer
- Utility
- Regulator/Admin

The system should verify relevant user and meter information before enabling energy trading.

---

## 6.2 Smart Meter Data Integration

The platform should support integration with smart-meter/utility APIs.

For the hackathon MVP, real utility APIs can be replaced with simulated meter data.

Required data:

```text
Meter ID
User ID
Timestamp
Energy Generated
Energy Consumed
Energy Exported
Energy Imported
```

---

## 6.3 Surplus Energy Calculation

The system calculates:

```text
Surplus Energy =
Verified Generation - Eligible Consumption
```

Only verified and eligible surplus energy can be converted into Energy Credits.

---

## 6.4 Energy Credit Generation

Verified surplus energy is converted into Energy Credits.

Example:

```text
Verified Surplus = 130 kWh

Energy Credits = 130 EC
```

Each Energy Credit receives:

- Unique identifier
- Energy quantity
- Source prosumer
- Generation timestamp
- Location/grid zone
- Verification status
- Expiration/settlement status

---

## 6.5 P2P Marketplace

Prosumers can list available Energy Credits.

Marketplace listings may contain:

```text
Available Credits
Price / EC
Seller
Generation period
Grid zone
Distance/eligibility
Expiration
```

Consumers can search and purchase eligible credits.

---

## 6.6 Buyer-Seller Matching

The matching engine considers:

1. Energy requirement
2. Available supply
3. Price
4. Location/grid zone
5. Grid capacity
6. Credit validity
7. Seller availability

Example:

```text
Buyer Requirement = 100 EC

Seller A = 50 EC @ ₹4.20
Seller B = 30 EC @ ₹4.10
Seller C = 40 EC @ ₹4.30

Matching Engine
       ↓
A + B + C
       ↓
100 EC fulfilled
```

---

## 6.7 Dynamic Pricing

The platform dynamically calculates indicative market prices using:

- Supply
- Demand
- Base utility/reference price
- Grid congestion
- Local market conditions

Conceptual model:

```text
Final Price =
Base Price
+ Demand Adjustment
- Supply Adjustment
+ Congestion Adjustment
```

The exact pricing formula can be configured by the platform/utility according to the applicable market rules.

---

## 6.8 Grid Congestion Management

The platform should consider available distribution capacity.

Example:

```text
Grid Capacity       = 1000 kW
Current Load        = 850 kW
Available Capacity  = 150 kW
```

If a proposed transaction exceeds the applicable capacity, the platform can:

- Reject the trade.
- Delay the trade.
- Reduce the eligible trading quantity.
- Redirect matching toward another eligible grid zone.

---

## 6.9 Transaction Settlement

After a successful trade:

```text
Seller
  ↓
Energy Credits
  ↓
Marketplace
  ↓
Buyer
```

The platform records:

```text
Transaction ID
Seller ID
Buyer ID
Energy Credits
Price
Total Amount
Timestamp
Grid Zone
Settlement Status
```

A distributed ledger/blockchain may be used to create a tamper-evident transaction record.

---

## 6.10 DISCOM Bill Settlement

The purchased Energy Credits are sent to the participating utility/DISCOM settlement system.

Example:

```text
Consumer purchases:

100 EC × ₹4 = ₹400

Eligible bill adjustment:
100 kWh

Consumer's applicable electricity bill
is reduced/adjusted according to
the utility's approved settlement rules.
```

The exact financial adjustment mechanism must follow the participating DISCOM's approved tariff and regulatory framework.

---

## 6.11 Dashboards

### Prosumer Dashboard

Display:

- Solar generation
- Consumption
- Surplus
- Available Energy Credits
- Credits sold
- Earnings
- Current market price
- Transaction history

---

### Consumer Dashboard

Display:

- Energy consumption
- Required credits
- Available marketplace credits
- Current price
- Purchased credits
- Estimated savings
- Bill adjustment status

---

### Utility Dashboard

Display:

- Total energy generated
- Total P2P energy traded
- Active prosumers
- Active consumers
- Grid load
- Grid congestion
- Settlement status
- Market price
- Renewable-energy utilization

---

### Admin/Regulator Dashboard

Display:

- Total transactions
- Energy traded
- Market price trends
- User activity
- Suspicious transactions
- Grid-zone activity
- Settlement failures
- Audit records

---

# 7. Non-Functional Requirements

## Performance

- Marketplace updates should be near real-time.
- Pricing calculations should complete within seconds.
- Transaction status should update immediately after confirmation.

## Security

- Secure authentication.
- Role-based authorization.
- Encrypted sensitive data.
- API authentication.
- Tamper-evident transaction records.
- Prevention of duplicate credit issuance.

## Reliability

The system should handle:

- Meter API failures.
- Payment failures.
- Settlement failures.
- Temporary blockchain/network failures.
- Duplicate meter readings.

## Scalability

The architecture should support expansion from:

```text
100 users
      ↓
1,000 users
      ↓
100,000+ users
```

and eventually support multiple utilities/grid zones.

---

# 8. Business Model

The platform can generate revenue through:

### Transaction Fee

A small fee can be charged per successfully settled Energy Credit transaction.

Example:

```text
Consumer pays      ₹4.50 / EC

Prosumer receives  ₹4.00 / EC
Platform receives  ₹0.50 / EC
```

The exact pricing and fee structure would depend on regulatory and utility agreements.

### Utility Integration Fee

Participating utilities may pay for:

- Marketplace infrastructure
- Settlement services
- Analytics
- Grid optimization
- API integration

### Enterprise Dashboard

Commercial and industrial customers can receive:

- Energy analytics
- Renewable-energy reports
- Consumption optimization
- Automated trading

---

# 9. Key Value Proposition

### For Prosumers

> Convert surplus renewable generation into additional economic value.

### For Consumers

> Access potentially lower-cost renewable energy through a transparent marketplace.

### For Utilities

> Utilize distributed renewable generation through an additional digital market while retaining control of the physical grid and settlement process.

### For Regulators

> Obtain transparent and auditable visibility into P2P renewable-energy transactions.

---

# 10. Key USP

The platform's USP is not simply P2P energy trading.

The proposed differentiation is:

> **A unified ecosystem combining verified Energy Credits, localized P2P matching, dynamic pricing, grid-aware trading, and DISCOM bill settlement without requiring users to purchase additional hardware.**

### Four Core Pillars

```text
        VERIFIED
           +
          LOCAL
           +
        DYNAMIC
           +
       BILL-SETTLED
           ↓
     ENERGY CREDIT
      MARKETPLACE
```

---

# 11. Hackathon MVP

The MVP should focus on demonstrating the complete transaction lifecycle.

### MVP Flow

```text
1. Register Prosumer
        ↓
2. Simulate Solar Generation
        ↓
3. Simulate Consumption
        ↓
4. Calculate Surplus
        ↓
5. Generate Energy Credits
        ↓
6. List Credits
        ↓
7. Consumer Requests Energy
        ↓
8. Matching Engine
        ↓
9. Dynamic Price Calculation
        ↓
10. Purchase
        ↓
11. Record Transaction
        ↓
12. Simulate DISCOM Bill Adjustment
```

### MVP should NOT require

- Actual electricity transmission between homes.
- Physical smart-meter installation.
- Real-time control of the electrical grid.
- Production utility APIs.
- Real financial settlement.
- Full regulatory deployment.

These can be demonstrated through simulated/mock integrations.

---

# 12. Success Metrics

The prototype can measure:

- Total Energy Credits generated.
- Total Energy Credits traded.
- Number of active prosumers.
- Number of active consumers.
- Average consumer savings.
- Average prosumer earnings.
- Renewable energy utilization.
- Number of successful transactions.
- Average transaction/settlement time.
- Grid congestion avoided or managed.

---

# 13. Future Scope

The platform can eventually support:

- Real smart-meter APIs.
- Multiple DISCOMs.
- AI-based demand forecasting.
- AI-based solar-generation forecasting.
- Battery storage integration.
- EV charging integration.
- Commercial and industrial energy trading.
- Automated trading.
- Dynamic grid incentives.
- Advanced grid congestion management.
- Regulatory reporting.
- Cross-DISCOM interoperability where permitted.

---

# 14. Product Principle

The platform follows one fundamental principle:

> **The grid remains the physical infrastructure; the platform becomes the digital marketplace and settlement layer for verified renewable-energy value.**

This allows the system to work with existing electricity infrastructure rather than attempting to replace it.