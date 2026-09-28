import IORedis, { type Redis } from "ioredis";
import { redisUrl } from "./env";

const globalForRedis = globalThis as unknown as { oceanxRedis?: Redis | null };

/** Shared ioredis connection (BullMQ requires maxRetriesPerRequest = null). */
export function getRedis(): Redis | null {
  if (globalForRedis.oceanxRedis !== undefined) return globalForRedis.oceanxRedis;
  const url = redisUrl();
  globalForRedis.oceanxRedis = url
    ? new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: true, lazyConnect: false })
    : null;
  return globalForRedis.oceanxRedis;
}

export async function closeRedis(): Promise<void> {
  const r = globalForRedis.oceanxRedis;
  globalForRedis.oceanxRedis = undefined;
  if (r) await r.quit().catch(() => undefined);
}
