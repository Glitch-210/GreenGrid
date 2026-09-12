-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PROSUMER', 'CONSUMER', 'UTILITY', 'REGULATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "MeterType" AS ENUM ('SOLAR', 'CONSUMER', 'BIDIRECTIONAL');

-- CreateEnum
CREATE TYPE "MeterStatus" AS ENUM ('ACTIVE', 'OFFLINE', 'SUSPENDED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "ZoneStatus" AS ENUM ('NORMAL', 'CONGESTED', 'OUTAGE');

-- CreateEnum
CREATE TYPE "Congestion" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "CreditStatus" AS ENUM ('VERIFIED', 'MINTED', 'AVAILABLE', 'LISTED', 'RESERVED', 'PURCHASED', 'SETTLED', 'RETIRED', 'EXPIRED', 'FROZEN');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'PARTIAL', 'RESERVED', 'SOLD', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('MATCHED', 'RESERVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('PENDING', 'MATCHED', 'RESERVED', 'PAYMENT_PENDING', 'PAID', 'CREDIT_TRANSFERRED', 'SETTLEMENT_PENDING', 'SETTLED', 'COMPLETED', 'PAYMENT_FAILED', 'BLOCKCHAIN_PENDING', 'BLOCKCHAIN_FAILED', 'SETTLEMENT_FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PayStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SettleStatus" AS ENUM ('PENDING', 'SUBMITTED', 'SETTLED', 'PARTIAL', 'FAILED', 'MISMATCH');

-- CreateEnum
CREATE TYPE "ReadingStatus" AS ENUM ('PENDING', 'VERIFIED', 'FLAGGED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "displayAlias" TEXT NOT NULL,
    "walletAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GridZone" (
    "id" TEXT NOT NULL,
    "zoneCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacityKw" DECIMAL(18,4) NOT NULL,
    "currentLoadKw" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "basePrice" DECIMAL(18,4) NOT NULL DEFAULT 4.00,
    "priceFloor" DECIMAL(18,4) NOT NULL DEFAULT 2.50,
    "priceCeiling" DECIMAL(18,4) NOT NULL DEFAULT 7.00,
    "lossFactor" DECIMAL(6,4) NOT NULL DEFAULT 0.87,
    "status" "ZoneStatus" NOT NULL DEFAULT 'NORMAL',
    "neighbourCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GridZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meter" (
    "id" TEXT NOT NULL,
    "meterNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gridZoneId" TEXT NOT NULL,
    "meterType" "MeterType" NOT NULL,
    "status" "MeterStatus" NOT NULL DEFAULT 'ACTIVE',
    "ratedKw" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Meter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "generationKwh" DECIMAL(18,4) NOT NULL,
    "consumptionKwh" DECIMAL(18,4) NOT NULL,
    "importKwh" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "exportKwh" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "surplusKwh" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "ReadingStatus" NOT NULL DEFAULT 'PENDING',
    "flagReason" TEXT,
    "creditIssued" BOOLEAN NOT NULL DEFAULT false,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnergyCredit" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sourceMeterId" TEXT NOT NULL,
    "readingId" TEXT NOT NULL,
    "quantityKwh" DECIMAL(18,4) NOT NULL,
    "availableKwh" DECIMAL(18,4) NOT NULL,
    "reservedKwh" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "soldKwh" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "retiredKwh" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "CreditStatus" NOT NULL DEFAULT 'AVAILABLE',
    "gridZoneId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "blockchainTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnergyCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "gridZoneId" TEXT NOT NULL,
    "quantityKwh" DECIMAL(18,4) NOT NULL,
    "remainingKwh" DECIMAL(18,4) NOT NULL,
    "pricePerKwh" DECIMAL(18,4) NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnergyMatch" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "quantityKwh" DECIMAL(18,4) NOT NULL,
    "pricePerKwh" DECIMAL(18,4) NOT NULL,
    "score" DECIMAL(6,4) NOT NULL,
    "gridZoneId" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'MATCHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnergyMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT,
    "quantityKwh" DECIMAL(18,4) NOT NULL,
    "pricePerKwh" DECIMAL(18,4) NOT NULL,
    "totalAmount" DECIMAL(18,4) NOT NULL,
    "platformFee" DECIMAL(18,4) NOT NULL,
    "sellerPayout" DECIMAL(18,4) NOT NULL,
    "status" "TxStatus" NOT NULL DEFAULT 'PENDING',
    "gridZoneId" TEXT NOT NULL,
    "blockchainTxHash" TEXT,
    "chainAttempts" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "paymentReference" TEXT NOT NULL,
    "status" "PayStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT NOT NULL DEFAULT 'MOCK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "discomReference" TEXT,
    "requestedKwh" DECIMAL(18,4) NOT NULL,
    "settledKwh" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "billAdjustment" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "SettleStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GridStatus" (
    "id" TEXT NOT NULL,
    "gridZoneId" TEXT NOT NULL,
    "loadKw" DECIMAL(18,4) NOT NULL,
    "generationKw" DECIMAL(18,4) NOT NULL,
    "availableCapacityKw" DECIMAL(18,4) NOT NULL,
    "congestionLevel" "Congestion" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GridStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnergyPrice" (
    "id" TEXT NOT NULL,
    "gridZoneId" TEXT NOT NULL,
    "basePrice" DECIMAL(18,4) NOT NULL,
    "demandFactor" DECIMAL(8,4) NOT NULL,
    "supplyFactor" DECIMAL(8,4) NOT NULL,
    "congestionFactor" DECIMAL(8,4) NOT NULL,
    "finalPrice" DECIMAL(18,4) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnergyPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_displayAlias_key" ON "User"("displayAlias");

-- CreateIndex
CREATE UNIQUE INDEX "GridZone_zoneCode_key" ON "GridZone"("zoneCode");

-- CreateIndex
CREATE UNIQUE INDEX "Meter_meterNumber_key" ON "Meter"("meterNumber");

-- CreateIndex
CREATE INDEX "Meter_userId_idx" ON "Meter"("userId");

-- CreateIndex
CREATE INDEX "Meter_gridZoneId_idx" ON "Meter"("gridZoneId");

-- CreateIndex
CREATE INDEX "MeterReading_meterId_timestamp_idx" ON "MeterReading"("meterId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "MeterReading_meterId_externalId_key" ON "MeterReading"("meterId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "MeterReading_meterId_timestamp_key" ON "MeterReading"("meterId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "EnergyCredit_creditId_key" ON "EnergyCredit"("creditId");

-- CreateIndex
CREATE UNIQUE INDEX "EnergyCredit_readingId_key" ON "EnergyCredit"("readingId");

-- CreateIndex
CREATE INDEX "EnergyCredit_ownerId_status_idx" ON "EnergyCredit"("ownerId", "status");

-- CreateIndex
CREATE INDEX "EnergyCredit_gridZoneId_status_idx" ON "EnergyCredit"("gridZoneId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceListing_status_gridZoneId_pricePerKwh_idx" ON "MarketplaceListing"("status", "gridZoneId", "pricePerKwh");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_transactionId_key" ON "Transaction"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transaction_buyerId_idx" ON "Transaction"("buyerId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentReference_key" ON "Payment"("paymentReference");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_transactionId_key" ON "Settlement"("transactionId");

-- CreateIndex
CREATE INDEX "GridStatus_gridZoneId_timestamp_idx" ON "GridStatus"("gridZoneId", "timestamp");

-- CreateIndex
CREATE INDEX "EnergyPrice_gridZoneId_timestamp_idx" ON "EnergyPrice"("gridZoneId", "timestamp");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Meter" ADD CONSTRAINT "Meter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meter" ADD CONSTRAINT "Meter_gridZoneId_fkey" FOREIGN KEY ("gridZoneId") REFERENCES "GridZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "Meter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnergyCredit" ADD CONSTRAINT "EnergyCredit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnergyCredit" ADD CONSTRAINT "EnergyCredit_sourceMeterId_fkey" FOREIGN KEY ("sourceMeterId") REFERENCES "Meter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnergyCredit" ADD CONSTRAINT "EnergyCredit_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "MeterReading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "EnergyCredit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_gridZoneId_fkey" FOREIGN KEY ("gridZoneId") REFERENCES "GridZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnergyMatch" ADD CONSTRAINT "EnergyMatch_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnergyMatch" ADD CONSTRAINT "EnergyMatch_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GridStatus" ADD CONSTRAINT "GridStatus_gridZoneId_fkey" FOREIGN KEY ("gridZoneId") REFERENCES "GridZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnergyPrice" ADD CONSTRAINT "EnergyPrice_gridZoneId_fkey" FOREIGN KEY ("gridZoneId") REFERENCES "GridZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
