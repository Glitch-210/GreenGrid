/**
 * §9 seed data CLI entry point. Run: npm run db:seed (from apps/api).
 * The actual seed logic lives in src/lib/seed-runner.ts so it can also be
 * imported in-process by the admin "Reset data" endpoint (demo.service.ts).
 */
import { PrismaClient } from "@prisma/client";
import { runSeed } from "../src/lib/seed-runner";

const prisma = new PrismaClient();

runSeed(prisma)
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
