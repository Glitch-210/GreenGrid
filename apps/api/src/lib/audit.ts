import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export async function audit(
  db: Db,
  action: string,
  entityType: string,
  entityId: string,
  userId?: string | null,
  metadata?: Record<string, unknown>,
) {
  await db.auditLog.create({
    data: { action, entityType, entityId, userId: userId ?? null, metadata: metadata as Prisma.InputJsonValue },
  });
}
