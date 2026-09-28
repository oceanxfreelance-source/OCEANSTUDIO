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

// In-memory fallback for local development without Redis. In production a
// shared Redis is required because serverless instances do not share memory.
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
  } else if (process.env.NODE_ENV === "production") {
    logger.warn("REDIS_URL not configured: rate limiting is per-instance only");
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

export async function enforce(rule: RateLimitRule, identifier: string): Promise<void> {
  const r = await consume(rule, identifier);
  if (!r.allowed) throw tooManyRequests(r.retryAfter);
}

export async function resetRateLimit(rule: RateLimitRule, identifier: string): Promise<void> {
  const key = `rl:${rule.name}:${identifier}`;
  memory.delete(key);
  await getRedis()?.del(key).catch(() => undefined);
}

export function clearMemoryRateLimits(): void {
  memory.clear();
}
