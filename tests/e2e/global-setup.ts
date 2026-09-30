import { PrismaClient } from "@prisma/client";

/** Reset rate-limit counters so repeated local runs aren't throttled. */
export default async function globalSetup() {
  if (!process.env.DATABASE_URL) return;
  const db = new PrismaClient();
  await db.rateLimit.deleteMany({});
  await db.$disconnect();
}
