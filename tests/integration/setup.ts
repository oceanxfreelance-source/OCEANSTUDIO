import { afterAll } from "vitest";
import { applyTestEnv } from "./env";

applyTestEnv();

afterAll(async () => {
  const { closeQueues } = await import("@/lib/queue");
  const { closeRedis } = await import("@/lib/redis");
  const { db } = await import("@/lib/db");
  await closeQueues();
  await closeRedis();
  await db.$disconnect();
});
