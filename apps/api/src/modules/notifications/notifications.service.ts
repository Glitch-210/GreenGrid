import { prisma } from "../../config/prisma";
import { ApiError } from "../../lib/ApiError";

export async function listNotifications(userId: string) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
}

export async function markRead(userId: string, id: string) {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== userId) throw ApiError.notFound("Notification not found");
  return prisma.notification.update({ where: { id }, data: { isRead: true } });
}

export async function createNotification(userId: string, type: string, title: string, message: string) {
  return prisma.notification.create({ data: { userId, type, title, message } });
}
