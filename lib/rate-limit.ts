import { db } from "./db";
import { tooManyRequests } from "./errors";
import { logger } from "./logger";
import { getRedis } from "./redis";

export interface RateLimitRule {
  /** bucket name, e.g. "admin-login" */
  name: string;
  limit: number;
  windowSeconds: number;
}

export const RULES = {
  adminLogin: { name: "admin-login", limit: 10, windowSeconds: 15 * 60 },
  clientLogin: { name: "client-login", limit: 10, windowSeconds: 15 * 60 },
  galleryAccess: { name: "gallery-access", limit: 120, windowSeconds: 60 },
  download: { name: "download", limit: 120, windowSeconds: 60 },
  processing: { name: "processing", limit: 60, windowSeconds: 60 },
  uploadInit: { name: "upload-init", limit: 600, windowSeconds: 60 },
  adminApi: { name: "admin-api", limit: 1200, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

// Without Redis: production uses a Postgres counter table (serverless
// instances do not share memory); local development/tests use memory.
const memory = new Map<string, { count: number; resetAt: number }>();

export async function consume(rule: RateLimitRule, identifier: string): Promise<{ allowed: boolean; retryAfter: number }> {
  const key = `rl:${rule.name}:${identifier}`;
  const redis = getRedis();
  if (redis) {
    try {
      const results = await redis.multi().incr(key).expire(key, rule.windowSeconds, "NX").ttl(key).exec();
      const count = Number(results?.[0]?.[1] ?? 0);
      const ttl = Number(results?.[2]?.[1] ?? rule.windowSeconds);
      return { allowed: count <= rule.limit, retryAfter: Math.max(1, ttl) };
    } catch (err) {
      logger.error({ err }, "rate limiter redis failure; falling back to memory");
    }
  } else if (process.env.NODE_ENV === "production" || process.env.RATE_LIMIT_STORE === "postgres") {
    try {
      return await consumePostgres(key, rule);
    } catch (err) {
      logger.error({ err }, "rate limiter postgres failure; falling back to memory");
    }
  }
  const t = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= t) {
    memory.set(key, { count: 1, resetAt: t + rule.windowSeconds * 1000 });
    return { allowed: true, retryAfter: rule.windowSeconds };
  }
  entry.count += 1;
  return { allowed: entry.count <= rule.limit, retryAfter: Math.ceil((entry.resetAt - t) / 1000) };
}

/** Atomic fixed-window counter in Postgres (one upsert per request). */
async function consumePostgres(key: string, rule: RateLimitRule): Promise<{ allowed: boolean; retryAfter: number }> {
  const rows = await db.$queryRaw<{ count: number; reset_at: Date }[]>`
    INSERT INTO rate_limits (key, count, reset_at)
    VALUES (${key}, 1, (now() AT TIME ZONE 'UTC') + make_interval(secs => ${rule.windowSeconds}::double precision))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at <= (now() AT TIME ZONE 'UTC') THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= (now() AT TIME ZONE 'UTC') THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
    RETURNING count, reset_at`;
  const row = rows[0]!;
  // Opportunistic pruning of stale windows (~1% of requests).
  if (Math.random() < 0.01) await db.$executeRaw`DELETE FROM rate_limits WHERE reset_at < (now() AT TIME ZONE 'UTC') - interval '1 hour'`.catch(() => undefined);
  const retryAfter = Math.max(1, Math.ceil((row.reset_at.getTime() - Date.now()) / 1000));
  return { allowed: Number(row.count) <= rule.limit, retryAfter };
}

export async function enforce(rule: RateLimitRule, identifier: string): Promise<void> {
  const r = await consume(rule, identifier);
  if (!r.allowed) throw tooManyRequests(r.retryAfter);
}

export async function resetRateLimit(rule: RateLimitRule, identifier: string): Promise<void> {
  const key = `rl:${rule.name}:${identifier}`;
  memory.delete(key);
  await db.rateLimit.deleteMany({ where: { key } }).catch(() => undefined);
  await getRedis()?.del(key).catch(() => undefined);
}

export function clearMemoryRateLimits(): void {
  memory.clear();
}
