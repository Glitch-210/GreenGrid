/** True if `err` is a Prisma unique-constraint violation (P2002) on `field`. */
export function isUniqueConstraintOn(err: unknown, field: string): boolean {
  const e = err as { code?: string; meta?: { target?: string[] | string } } | null;
  if (!e || e.code !== "P2002") return false;
  const target = e.meta?.target;
  if (!target) return false;
  return Array.isArray(target) ? target.includes(field) : target.includes(field);
}

/**
 * True if `err` is a transient interactive-transaction failure — the connection was
 * dropped/reassigned mid-transaction (e.g. a pooler recycling it) or the transaction's
 * own timeout fired. Prisma surfaces both as P2028 ("Transaction API error",
 * "Transaction already closed", "Transaction not found"). Distinct from a serialization
 * failure: this is infra flakiness, not expected contention, and should be reported to
 * the caller differently (retry, not "credits taken").
 */
export function isTransientTransactionError(err: unknown): boolean {
  const e = err as { code?: string } | null;
  return e?.code === "P2028";
}
