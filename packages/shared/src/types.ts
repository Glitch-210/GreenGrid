// Shared DTO shapes for FE/BE. Decimal fields are transported as strings over JSON.
import type {
  Role,
  UserStatus,
  MeterType,
  MeterStatus,
  ZoneStatus,
  Congestion,
  CreditStatus,
  ListingStatus,
  MatchStatus,
  TxStatus,
  PayStatus,
  SettleStatus,
  ReadingStatus,
  ErrorCode,
} from "./enums";

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiFailure {
  success: false;
  message: string;
  errorCode: ErrorCode | string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  status: UserStatus;
  displayAlias: string;
  walletAddress?: string | null;
  createdAt: string;
}

export interface GridZoneDTO {
  id: string;
  zoneCode: string;
  name: string;
  capacityKw: string;
  currentLoadKw: string;
  basePrice: string;
  priceFloor: string;
  priceCeiling: string;
  lossFactor: string;
  status: ZoneStatus;
  neighbourCodes: string[];
}

export interface MeterDTO {
  id: string;
  meterNumber: string;
  userId: string;
  gridZoneId: string;
  meterType: MeterType;
  status: MeterStatus;
  installedAt: string;
}

export interface MeterReadingDTO {
  id: string;
  meterId: string;
  externalId: string;
  timestamp: string;
  generationKwh: string;
  consumptionKwh: string;
  importKwh: string;
  exportKwh: string;
  surplusKwh: string;
  status: ReadingStatus;
  flagReason?: string | null;
  creditIssued: boolean;
}

export interface EnergyCreditDTO {
  id: string;
  creditId: string;
  ownerId: string;
  sourceMeterId: string;
  readingId: string;
  quantityKwh: string;
  availableKwh: string;
  reservedKwh: string;
  soldKwh: string;
  retiredKwh: string;
  status: CreditStatus;
  gridZoneId: string;
  generatedAt: string;
  expiresAt: string;
  blockchainTxHash?: string | null;
}

export interface MarketplaceListingDTO {
  id: string;
  sellerId: string;
  sellerAlias: string;
  creditId: string;
  gridZoneId: string;
  zoneName: string;
  quantityKwh: string;
  remainingKwh: string;
  pricePerKwh: string;
  status: ListingStatus;
  createdAt: string;
  expiresAt: string;
}

export interface EnergyMatchDTO {
  id: string;
  transactionId?: string | null;
  buyerId: string;
  sellerId: string;
  listingId: string;
  quantityKwh: string;
  pricePerKwh: string;
  score: string;
  gridZoneId: string;
  status: MatchStatus;
}

export interface AllocationDTO {
  listingId: string;
  sellerAlias: string;
  kwh: string;
  price: string;
  score: string;
}

export interface MatchPreviewDTO {
  allocations: AllocationDTO[];
  filledKwh: string;
  unfilledKwh: string;
  weightedAvgPrice: string;
}

export interface TransactionDTO {
  id: string;
  transactionId: string;
  buyerId: string;
  sellerId?: string | null;
  quantityKwh: string;
  pricePerKwh: string;
  totalAmount: string;
  platformFee: string;
  sellerPayout: string;
  status: TxStatus;
  gridZoneId: string;
  blockchainTxHash?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface PaymentDTO {
  id: string;
  transactionId: string;
  amount: string;
  paymentReference: string;
  status: PayStatus;
  paymentMethod: string;
}

export interface SettlementDTO {
  id: string;
  transactionId: string;
  consumerId: string;
  discomReference?: string | null;
  requestedKwh: string;
  settledKwh: string;
  billAdjustment: string;
  status: SettleStatus;
}

export interface GridStatusDTO {
  gridZoneId: string;
  loadKw: string;
  generationKw: string;
  availableCapacityKw: string;
  congestionLevel: Congestion;
  timestamp: string;
}

export interface EnergyPriceDTO {
  gridZoneId: string;
  basePrice: string;
  demandFactor: string;
  supplyFactor: string;
  congestionFactor: string;
  finalPrice: string;
  timestamp: string;
}

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}
