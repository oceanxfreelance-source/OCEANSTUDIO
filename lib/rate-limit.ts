import { db } from "./db";

/**
 * Simple fixed-window rate limiter stored in Postgres, so it works across all
 * serverless instances. Returns true when the action is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limits (key, count, reset_at)
    VALUES (${key}, 1, (now() AT TIME ZONE 'UTC') + make_interval(secs => ${windowSeconds}::double precision))
    ON CONFLICT (key) DO UPDATE SET
      count    = CASE WHEN rate_limits.reset_at <= (now() AT TIME ZONE 'UTC') THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= (now() AT TIME ZONE 'UTC') THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
    RETURNING count`;
  // Occasionally prune old rows.
  if (Math.random() < 0.02) {
    await db.$executeRaw`DELETE FROM rate_limits WHERE reset_at < (now() AT TIME ZONE 'UTC') - interval '1 day'`.catch(() => undefined);
  }
  return Number(rows[0]?.count ?? 0) <= limit;
}

export async function clearRateLimit(key: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key } });
}
