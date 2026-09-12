import { Role } from "@wattshare/shared";
import { ApiError } from "./ApiError";
import type { AuthUser } from "../middleware/auth.middleware";

/**
 * Roles allowed to read other users' records for oversight (DISCOM reconciliation,
 * regulatory audit, support). They are read-only here by convention — write paths
 * must still assert true ownership.
 */
const OVERSIGHT_ROLES: Role[] = [Role.UTILITY, Role.REGULATOR, Role.ADMIN];

export function isOversight(user: AuthUser): boolean {
  return OVERSIGHT_ROLES.includes(user.role);
}

/**
 * Assert `user` owns the record. `authMiddleware` establishes WHO the caller is;
 * this establishes WHAT they may touch — the check that was missing across meters,
 * credits, transactions and settlements.
 *
 * Deliberately reports 404 rather than 403 for non-owners: a 403 confirms the id
 * exists, which leaks the existence of other users' records to anyone probing.
 */
export function assertOwns(user: AuthUser, ownerId: string, what: string): void {
  if (user.id === ownerId) return;
  throw ApiError.notFound(`${what} not found`);
}

/** As `assertOwns`, but oversight roles may read. Use on read paths only. */
export function assertCanRead(user: AuthUser, ownerId: string, what: string): void {
  if (user.id === ownerId || isOversight(user)) return;
  throw ApiError.notFound(`${what} not found`);
}

/** As `assertCanRead`, for records with more than one legitimate party. */
export function assertCanReadAny(user: AuthUser, ownerIds: (string | null | undefined)[], what: string): void {
  if (ownerIds.some((id) => id && id === user.id) || isOversight(user)) return;
  throw ApiError.notFound(`${what} not found`);
}
