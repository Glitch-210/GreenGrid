export const SOCKET_EVENTS = {
  PRICE_UPDATE: "price:update",
  MARKETPLACE_UPDATE: "marketplace:update",
  GRID_UPDATE: "grid:update",
  ENERGY_UPDATE: "energy:update",
  CREDIT_MINTED: "credit:minted",
  TRADE_MATCHED: "trade:matched",
  PAYMENT_UPDATED: "payment:updated",
  SETTLEMENT_UPDATED: "settlement:updated",
  NOTIFICATION_NEW: "notification:new",
} as const;

export function zoneRoom(gridZoneId: string) {
  return `zone:${gridZoneId}`;
}

export function userRoom(userId: string) {
  return `user:${userId}`;
}
