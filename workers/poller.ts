import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { runDeliveryCleanup } from "@/server/cleanup";
import { dispatch } from "./dispatch";

/**
 * Redis-free worker mode: Postgres is the queue. Jobs are claimed atomically
 * with FOR UPDATE SKIP LOCKED, so any number of pollers can run safely.
 */

/** A job left PROCESSING by a worker that died (machine off, crash) is marked FAILED so it can be retried. */
export async function recoverStaleJobs(staleMinutes = 90): Promise<number> {
  const cutoff = new Date(Date.now() - staleMinutes * 60_000);
  const res = await db.processingJob.updateMany({
    where: { status: "PROCESSING", startedAt: { lt: cutoff } },
    data: {
      status: "FAILED",
      errorMessage: "The worker stopped while processing this job. Click Retry to run it again.",
      completedAt: new Date(),
    },
  });
  return res.count;
}

/** Atomically claim the oldest queued job id (or null). */
export async function claimNextJob(): Promise<string | null> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE processing_jobs SET status = 'PROCESSING', started_at = (now() AT TIME ZONE 'UTC'), stage = 'Claimed by worker'
    WHERE id = (
      SELECT id FROM processing_jobs WHERE status = 'QUEUED'
      ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING id`;
  return rows[0]?.id ?? null;
}

/** Process queued jobs until none are left. Returns how many ran. */
export async function drainQueue(maxJobs = Number.POSITIVE_INFINITY): Promise<number> {
  let n = 0;
  while (n < maxJobs) {
    const id = await claimNextJob();
    if (!id) break;
    n++;
    await dispatch(id).catch((err) => logger.warn({ err: (err as Error).message, jobId: id }, "job failed"));
  }
  return n;
}

/** Long-running poll loop used when REDIS_URL is not configured. */
export async function runPoller(opts: { intervalMs?: number; signal?: AbortSignal } = {}): Promise<void> {
  const interval = opts.intervalMs ?? 5000;
  let lastSweep = 0;
  logger.info("OCEANX worker started in Postgres polling mode (no Redis)");
  while (!opts.signal?.aborted) {
    try {
      if (Date.now() - lastSweep > 60_000) {
        lastSweep = Date.now();
        const stale = await recoverStaleJobs();
        if (stale) logger.warn({ stale }, "marked stale jobs as failed");
        const reports = await runDeliveryCleanup();
        if (reports.length) logger.info({ reports }, "expiration sweep");
      }
      const ran = await drainQueue();
      if (ran) logger.info({ ran }, "processed jobs");
    } catch (err) {
      logger.error({ err }, "poll loop error");
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}
