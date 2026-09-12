import { Router } from "express";
import { Role } from "@wattshare/shared";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { prisma } from "../../config/prisma";
import { ok } from "../../lib/respond";

export const router = Router();

router.get("/", authMiddleware, requireRole(Role.REGULATOR, Role.ADMIN), async (_req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 200,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true,
            displayAlias: true,
          },
        },
      },
    });
    ok(res, logs);
  } catch (err) {
    next(err);
  }
});
