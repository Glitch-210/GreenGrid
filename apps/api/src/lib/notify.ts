import { logger } from "./logger";
import { createNotification } from "../modules/notifications/notifications.service";
import { emitToUser } from "../sockets/io";
import { SOCKET_EVENTS } from "../sockets/events";

/**
 * Persist a notification and push it down the user's socket in one step.
 *
 * The two halves were both missing: `createNotification` existed but had no call
 * sites anywhere, so the bell was permanently empty, and every lifecycle emit went
 * to the buyer only — a seller's credits could be reserved, sold, paid for and
 * settled without a single signal reaching them.
 *
 * Never throws. A notification is a side-effect of a trade, not part of it; failing
 * to record one must not roll back or fail the trade itself.
 */
export async function notify(
  userId: string,
  type: string,
  title: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  try {
    const row = await createNotification(userId, type, title, message);
    emitToUser(userId, SOCKET_EVENTS.NOTIFICATION_NEW, {
      id: row.id,
      type,
      title,
      message,
      isRead: false,
      createdAt: row.createdAt,
      ...extra,
    });
    return row;
  } catch (err) {
    logger.warn("notification failed", { userId, type, err: String(err) });
    return null;
  }
}

/** Fan a notification out to several users at once, de-duplicating ids. */
export async function notifyEach(
  userIds: (string | null | undefined)[],
  type: string,
  title: string,
  message: (userId: string) => string,
  extra?: Record<string, unknown>,
) {
  // One transaction can produce several matches for the same seller — they should
  // get one notification, not one per match.
  const unique = [...new Set(userIds.filter((id): id is string => !!id))];
  await Promise.all(unique.map((id) => notify(id, type, title, message(id), extra)));
  return unique.length;
}
