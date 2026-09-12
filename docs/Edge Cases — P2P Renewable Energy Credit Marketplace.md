# Edge Cases

## 1. Overview

The P2P Renewable Energy Credit Marketplace depends on multiple systems:

- Solar generation
- Smart meters
- Utility/DISCOM systems
- Marketplace
- Dynamic pricing
- Payments
- Blockchain
- Bill settlement

Because of these dependencies, the system must handle situations where energy data, transactions, payments, or external services are incorrect or unavailable.

The fundamental rule is:

> **Energy Credits must only be created, transferred, and settled when the underlying energy data is verified and the transaction is valid.**

---

# 2. Energy Generation Edge Cases

## 2.1 No Solar Generation

Example:

```text id="2z3x11"
Generation = 0 kWh
Consumption = 5 kWh
```

Result:

```text id="3x7q2r"
Surplus = 0
New Credits = 0
```

The user cannot create Energy Credits.

---

## 2.2 Generation Lower Than Consumption

```text id="q5c7o0"
Generation = 3 kWh
Consumption = 5 kWh

Surplus = -2 kWh
```

The user is a net consumer during this period.

Result:

> No Energy Credits are created.

---

## 2.3 Generation Equals Consumption

```text id="o9u3ab"
Generation = 5 kWh
Consumption = 5 kWh

Surplus = 0
```

Result:

> No credits are created.

---

## 2.4 Extremely High Generation

If meter data suddenly reports an unrealistic value:

```text id="jv5kq8"
Expected = 10 kWh
Reported = 10,000 kWh
```

The system should flag the reading.

```text id="w8z5tu"
Meter Reading
      ↓
Validation
      ↓
Abnormal?
    /   \
  YES    NO
   ↓      ↓
Flag    Process
```

No credits should be created until the reading is verified.

---

# 3. Meter Data Edge Cases

## 3.1 Smart Meter Offline

If the meter stops sending data:

```text id="b8g1w6"
Meter Offline
     ↓
No New Verified Data
     ↓
No New Credits
```

Existing credits remain unaffected.

---

## 3.2 Duplicate Meter Reading

The same reading arrives twice.

Example:

```text id="3q2m5v"
Reading ID = R1001
```

received twice.

The system should detect the duplicate using:

- Reading ID
- Meter ID
- Timestamp
- Data hash

and process it only once.

---

## 3.3 Out-of-Order Meter Data

A reading from 12:00 arrives after a reading from 12:05.

The system should process readings using their timestamps rather than assuming arrival order.

---

## 3.4 Missing Meter Data

Example:

```text id="e5r9m3"
10:00 → Available
10:15 → Missing
10:30 → Available
```

The platform should not automatically estimate the missing energy unless the utility-approved data policy permits estimation.

Credits based on unverified data should remain pending.

---

## 3.5 Meter Tampering

If the utility reports suspicious meter activity:

```text id="8j5h2a"
Meter Status = FLAGGED
```

The platform should:

- Stop new credit creation.
- Freeze affected credits if required.
- Flag the account.
- Notify the utility/admin.
- Require verification before reactivation.

---

# 4. Energy Credit Edge Cases

## 4.1 Attempt to Create More Credits Than Verified Energy

Example:

```text id="7h3b1k"
Verified Surplus = 100 kWh

User requests = 150 EC
```

Result:

> Transaction rejected.

Maximum credits:

```text id="z0n9x7"
100 EC
```

---

## 4.2 Double Credit Creation

The same surplus cannot be used twice.

Example:

```text id="r5q7p8"
Surplus = 100 kWh

First credit issuance:
100 EC ✓

Second credit issuance:
100 EC ✗
```

The system must maintain a unique reference to the underlying verified energy record.

---

## 4.3 Double Spending of Credits

A seller has:

```text id="x5v8q4"
100 EC
```

They attempt to sell:

```text id="l2d7m0"
60 EC → Buyer A
60 EC → Buyer B
```

The second transaction must fail because only:

```text id="6j7x9s"
40 EC
```

remain available.

---

## 4.4 Partial Credit Sale

A seller has:

```text id="r8n4k2"
100 EC
```

and sells:

```text id="w5c3z7"
40 EC
```

Remaining balance:

```text id="t9q1m6"
60 EC
```

The system must support partial sales.

---

## 4.5 Credit Expiration

If Energy Credits are only valid for a specific settlement period:

```text id="p3v7n1"
Credit Created
      ↓
Validity Period
      ↓
Expiration
```

Expired credits cannot be sold.

The expiration rules should be configurable according to utility/regulatory requirements.

---

# 5. Marketplace Edge Cases

## 5.1 Seller Cancels Listing

If a seller cancels an unsold listing:

```text id="n4w6p8"
Listed Credits
      ↓
Cancel
      ↓
Credits Returned
      ↓
Available Balance
```

---

## 5.2 Buyer Cancels Purchase

If cancellation is allowed before settlement:

```text id="f6y8k3"
Reserved Credits
      ↓
Purchase Cancelled
      ↓
Credits Released
```

---

## 5.3 Seller Has Insufficient Credits

Seller lists:

```text id="s5h9j2"
100 EC
```

but only has:

```text id="v2m7q1"
60 EC
```

The listing must be rejected.

---

## 5.4 Multiple Buyers Compete for the Same Credits

If several buyers try to purchase the same listing simultaneously:

```text id="z8w3q5"
Seller: 100 EC

Buyer A → 70 EC
Buyer B → 60 EC
```

The backend transaction must lock/reserve credits so that total successful purchases never exceed 100 EC.

---

## 5.5 Multiple Sellers Fulfill One Buyer

A consumer requires:

```text id="k5c9m2"
200 EC
```

Available:

```text id="e7q3x1"
Seller A = 80 EC
Seller B = 70 EC
Seller C = 50 EC
```

The matching engine can combine all three:

```text id="q4p8n6"
80 + 70 + 50 = 200 EC
```

---

# 6. Pricing Edge Cases

## 6.1 No Sellers Available

```text id="a3m7k9"
Demand > 0
Supply = 0
```

Result:

> Marketplace shows no available Energy Credits.

The consumer can wait for new supply or use the normal electricity supply mechanism.

---

## 6.2 No Buyers Available

If supply is high but demand is low:

```text id="x7v2p5"
Supply ↑
Demand ↓
```

The dynamic pricing engine can reduce the indicative marketplace price according to configured rules.

---

## 6.3 Sudden Demand Spike

Example:

```text id="g8q1m4"
Normal Demand = 500 kWh
Sudden Demand = 2,000 kWh
```

The pricing engine recalculates the market price.

The platform should also apply configured price limits to prevent extreme prices.

---

## 6.4 Sudden Supply Spike

Example:

```text id="p9r4c6"
Solar Generation ↑↑
Supply ↑↑
```

The pricing engine can lower the market price according to the configured supply-demand model.

---

## 6.5 Price Manipulation

A seller attempts to list:

```text id="h4z8w1"
₹1000 / kWh
```

when the normal market price is:

```text id="x6q2m9"
₹4 / kWh
```

The system can apply:

- Maximum price limits.
- Minimum price limits.
- Market-based validation.
- Admin/utility-configured price bands.

---

# 7. Grid Edge Cases

## 7.1 Grid Congestion

Example:

```text id="e4c8y2"
Grid Capacity = 1000 kW
Current Load = 980 kW

Available Capacity = 20 kW
```

If a proposed trade exceeds the available capacity:

```text id="k3v6p1"
Trade Request
      ↓
Grid Check
      ↓
Capacity Insufficient
      ↓
Reject / Delay / Reduce Quantity
```

---

## 7.2 Grid Outage

If the utility reports an outage:

```text id="y7m2d4"
Grid Zone = OUTAGE
```

New trades in the affected zone should be paused.

Pending transactions should remain in a safe state until the grid becomes available.

---

## 7.3 Grid Zone Changes

If a user changes grid connection or meter:

```text id="w2q5n8"
Old Grid Zone
      ↓
Utility Verification
      ↓
New Grid Zone
```

Future trades should use the new grid zone.

Historical transactions should remain associated with the original zone.

---

## 7.4 Trading Across Ineligible Grid Zones

If two users are not allowed to participate in the same trading zone:

```text id="s6x1k9"
Buyer Zone ≠ Seller Eligible Zone
```

The matching engine must reject that pairing.

---

# 8. Payment Edge Cases

## 8.1 Payment Failure

```text id="r3m7q5"
Credit Reserved
      ↓
Payment Failed
      ↓
Reservation Released
      ↓
Credits Available Again
```

---

## 8.2 Payment Timeout

If payment status remains unknown:

```text id="n8c2v6"
Payment = PENDING
```

The system should not immediately transfer or retire the credits.

---

## 8.3 Duplicate Payment

A retry must not result in two successful purchases.

Each payment should have a unique:

```text id="t5k9p3"
Payment ID
Transaction ID
Idempotency Key
```

---

## 8.4 Refund

If an eligible transaction is cancelled before final settlement:

```text id="j4q7m2"
Purchase
  ↓
Cancellation
  ↓
Refund
  ↓
Credits Released
```

Refund rules depend on the platform's settlement policy.

---

# 9. Blockchain Edge Cases

## 9.1 Blockchain Network Unavailable

If blockchain confirmation is temporarily unavailable:

```text id="b3n8x5"
Transaction
     ↓
Blockchain unavailable
     ↓
Status = BLOCKCHAIN_PENDING
```

The platform retries asynchronously.

---

## 9.2 Smart Contract Failure

If a smart contract transaction fails:

```text id="c6m2r8"
Contract Call
     ↓
Failed
     ↓
Transaction not settled
     ↓
Credits remain protected
```

---

## 9.3 Blockchain Transaction Delayed

The user should see:

```text id="q8w4v1"
Transaction Status:

Processing...
Blockchain Confirmation Pending
```

rather than incorrectly showing it as completed.

---

## 9.4 Unauthorized Blockchain Operation

Only authorized backend/service wallets should be able to perform restricted smart-contract operations.

Unauthorized calls must be rejected.

---

# 10. Settlement Edge Cases

## 10.1 DISCOM API Unavailable

```text id="f7k2m9"
Trade Completed
      ↓
DISCOM API unavailable
      ↓
Settlement = PENDING
```

The transaction should not be lost.

---

## 10.2 Bill Adjustment Failure

If the utility rejects the bill adjustment:

```text id="u5x9c3"
Settlement Request
      ↓
Rejected
      ↓
Settlement Failed
      ↓
Manual Retry / Review
```

The system should preserve the complete transaction record.

---

## 10.3 Partial Settlement

Suppose:

```text id="e8r2v6"
Purchased = 100 EC
Settled = 80 EC
```

The platform must record:

```text id="m4q7x1"
Settled = 80 EC
Pending = 20 EC
```

instead of incorrectly marking all 100 EC as settled.

---

## 10.4 Settlement Mismatch

Platform says:

```text id="a2p6k9"
100 EC
```

Utility confirms:

```text id="h7c3m5"
95 EC
```

The system should flag:

```text id="r8v1q4"
Settlement Mismatch
```

for reconciliation.

---

# 11. User Account Edge Cases

## 11.1 User Deletes Account

Before deletion, the platform must check:

- Active listings.
- Pending transactions.
- Unsettled credits.
- Pending payments.

Accounts with unresolved financial/energy obligations should not be immediately deleted.

---

## 11.2 User Changes Meter

The new meter must be verified by the utility before it can generate Energy Credits.

---

## 11.3 Suspended User

A suspended user should not be able to:

- Create new credits.
- List credits.
- Purchase credits.

Existing transactions should be handled according to their current settlement state.

---

# 12. Fraud and Security Edge Cases

## 12.1 Fake Energy Data

If a user attempts to submit fabricated meter data:

```text id="w4k8m1"
Fake Reading
     ↓
Validation
     ↓
Rejected
```

Only trusted meter/utility sources should be allowed to generate eligible credits.

---

## 12.2 Replay Attack

An attacker resends an old valid meter reading.

The system should use:

- Timestamp validation.
- Unique reading ID.
- Nonce/idempotency.
- Previously processed record checks.

---

## 12.3 Account Takeover

If suspicious login behavior is detected:

- Require re-authentication.
- Temporarily restrict trading.
- Notify the user.
- Log the event.

---

## 12.4 Price Manipulation

Multiple accounts could attempt to artificially increase demand or supply.

The system can detect:

- Unusual trading patterns.
- Repeated cancellations.
- Abnormally large orders.
- Multiple accounts with suspicious relationships.

Such activity can be flagged for admin/regulator review.

---

# 13. Privacy Edge Cases

## 13.1 Exact Seller Location Exposure

The platform should not expose a prosumer's exact home address to buyers.

Instead show:

```text id="k6r3q8"
Grid Zone: Ahmedabad-West
Distance: Approx. 1.5 km
```

where permitted.

---

## 13.2 Personal Information Leakage

Only required information should be visible in marketplace listings.

Example:

```text id="d4n8x2"
Display:

Seller ID: Solar-Pro-102
Grid Zone: Zone A
Available: 100 EC
Price: ₹4.20/EC
```

Do not expose:

- Phone number
- Full address
- Personal identity details

unless required and authorized.

---

# 14. Credit Expiry Edge Cases

If credits expire:

### Before listing

```text id="y3p7m9"
Expired Credit
     ↓
Cannot List
```

### During listing

```text id="x5q2v8"
Credit expires
     ↓
Listing automatically closed
```

### During settlement

The system should follow the utility's approved settlement policy and prevent expired credits from being incorrectly settled.

---

# 15. Time Synchronization Edge Cases

Energy Credits depend on time-based meter data.

Potential issue:

```text id="n6c4r2"
Meter Time ≠ Server Time
```

The platform should use:

- Trusted timestamps.
- UTC internally.
- Utility-provided timestamps.
- Proper timezone conversion for user interfaces.

---

# 16. Concurrent Transaction Edge Case

Two consumers attempt to purchase the final available credits simultaneously.

Example:

```text id="s8m3k1"
Available = 100 EC

Buyer A → 100 EC
Buyer B → 100 EC
```

Only one transaction can successfully reserve the 100 EC.

The database must use:

- Atomic transactions.
- Row locking / equivalent concurrency controls.
- Idempotency.

---

# 17. Partial Availability Edge Case

Consumer requests:

```text id="q7x4p2"
500 EC
```

but marketplace can only provide:

```text id="m3k8v5"
350 EC
```

The platform can provide:

```text id="c9r1n6"
Option 1 → Buy 350 EC
Option 2 → Wait for additional supply
Option 3 → Use normal utility supply for remaining demand
```

---

# 18. Negative or Invalid Values

The system must reject:

```text id="z5f2w7"
Negative generation
Negative consumption
Negative credit quantity
Negative price
Invalid timestamps
Invalid meter IDs
```

Example:

```text id="n7c4x8"
Generation = -50 kWh
```

Result:

> Invalid meter reading.

---

# 19. API Failure Edge Cases

External APIs may:

- Timeout.
- Return invalid data.
- Return partial data.
- Return HTTP errors.
- Become unavailable.

The integration layer should implement:

```text id="w8p3m5"
Timeout
Retry
Circuit Breaker
Logging
Fallback
```

The platform should never create credits from an unverified API response.

---

# 20. Notification Failure

If notification delivery fails:

```text id="v5k2q7"
Transaction
     ↓
Notification Failed
```

The actual transaction should remain unaffected.

Notifications are informational and should not control financial/energy settlement.

---

# 21. Database Failure

If the database becomes temporarily unavailable:

```text id="j8m4x2"
Request
  ↓
Database Failure
  ↓
Transaction NOT completed
  ↓
Retry
```

Critical operations should be atomic.

---

# 22. Disaster Recovery

The production system should maintain:

- Database backups.
- Transaction logs.
- Blockchain transaction references.
- Audit logs.
- Recovery procedures.

Blockchain transaction hashes can help independently verify important settlement records.

---

# 23. Regulatory Edge Cases

## 23.1 P2P Trading Not Allowed in a Region

If local regulations do not permit a particular P2P settlement model:

```text id="s4y8m1"
Trading Disabled
      ↓
Platform operates in
information/analytics mode
```

The platform should not bypass regulatory restrictions.

---

## 23.2 Tariff Changes

If the utility changes its tariff:

```text id="e6q2r9"
New Tariff
    ↓
Pricing Engine
    ↓
Updated Marketplace Price
```

Pricing parameters should therefore be configurable rather than hard-coded.

---

## 23.3 Settlement Rule Changes

If the utility changes how Energy Credits are settled:

```text id="w9c3k5"
Utility Rule Update
       ↓
Configuration Update
       ↓
New Settlement Logic
```

Historical transactions should remain based on the rules applicable when they were created.

---

# 24. Extreme Market Conditions

## Very High Supply

```text id="p2x7m4"
Supply >>> Demand
```

Possible actions:

- Lower indicative price.
- Encourage buyers.
- Allow credits to remain available.
- Apply configured market limits.

---

## Very High Demand

```text id="n5q8c2"
Demand >>> Supply
```

Possible actions:

- Increase indicative price within configured limits.
- Prioritize eligible local supply.
- Notify consumers.
- Allow normal grid supply to cover remaining demand.

---

# 25. System Principle for Edge Cases

The system follows five safety principles:

```text id="x3r7m9"
1. Never create credits from unverified energy.

2. Never allow the same energy to be credited twice.

3. Never transfer more credits than available.

4. Never complete settlement without required confirmation.

5. Never allow marketplace logic to bypass grid,
   utility, or regulatory constraints.
```

---

# 26. Critical Edge Cases for Hackathon Demo

The following cases should actually be demonstrated during the SIH prototype:

### Case 1 — Surplus Generation

```text id="a7m3k9"
600 kWh Generated
450 kWh Consumed
       ↓
150 kWh Surplus
       ↓
150 Energy Credits
```

### Case 2 — Partial Sale

```text id="p4x8q2"
150 EC
 ↓
100 EC Sold
 ↓
50 EC Remaining
```

### Case 3 — Multiple Sellers

```text id="c8r2m6"
Seller A = 130 EC
Seller B = 400 EC
Buyer    = 500 EC

130 + 370 = 500 EC
```

### Case 4 — Insufficient Supply

```text id="h5v9n1"
Demand = 500 EC
Supply = 300 EC

300 EC → P2P
200 EC → Normal Grid Supply
```

### Case 5 — Grid Congestion

```text id="y2q6w8"
Available Grid Capacity = 50 kW
Trade Request = 100 kW

       ↓

Trade restricted
```

### Case 6 — Double Spending

```text id="m7k3p5"
Available = 100 EC

Buyer A = 70 EC ✓
Buyer B = 50 EC ✗
```

### Case 7 — DISCOM Settlement Failure

```text id="r4x8c1"
Trade Completed
       ↓
DISCOM unavailable
       ↓
Settlement Pending
       ↓
Retry
```

---

# 27. Final Edge-Case Strategy

The platform should follow a **fail-safe approach**:

```text id="z8n2m4"
             ERROR / ANOMALY
                    ↓
              VALIDATE DATA
                    ↓
              ┌─────┴─────┐
              ↓           ↓
           VALID        INVALID
              ↓           ↓
          PROCESS       REJECT
              ↓           ↓
          SETTLE        LOG/FLAG
```

For financial and energy-related operations:

> **When in doubt, preserve the credits and transaction state rather than marking an uncertain transaction as completed.**

This prevents loss of Energy Credits, double spending, incorrect bill adjustments, and inconsistent settlement records.