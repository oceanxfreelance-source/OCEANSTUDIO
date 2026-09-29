/**
 * OCEANX STUDIO background worker.
 *
 * Runs outside Vercel (Docker / VM / Fly / Railway / ECS…) with LibRaw, ExifTool
 * and FFmpeg installed. Consumes the photo, video, delivery and maintenance
 * queues and runs the scheduled 48-hour expiration cleanup.
 *
 * Without REDIS_URL the worker polls Postgres for QUEUED jobs instead (no
 * extra service needed — see workers/poller.ts).
 *
 *   npm run worker
 */
process.env.OCEANX_SERVICE ??= "worker";

import { Worker, type Job } from "bullmq";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getQueue, QUEUE_NAMES, type JobPayload } from "@/lib/queue";
import { closeRedis, getRedis } from "@/lib/redis";
import { cleanupDelivery, runDeliveryCleanup } from "@/server/cleanup";
import { run } from "@/services/exec";
import { dispatch } from "./dispatch";
import { runPoller } from "./poller";

async function checkTools() {
  for (const [cmd, args] of [["dcraw_emu", []], ["raw-identify", []], ["exiftool", ["-ver"]], ["ffmpeg", ["-version"]], ["ffprobe", ["-version"]]] as const) {
    const res = await run(cmd, [...args]).catch((e: Error) => ({ code: -1, stderr: e.message }));
    if (res.code === -1) throw new Error(`Worker requires "${cmd}" on PATH (see Dockerfile.worker)`);
  }
}

async function main() {
  const e = env();
  const connection = getRedis();
  await checkTools();

  if (!connection) {
    const ctrl = new AbortController();
    const stop = (signal: string) => {
      logger.info({ signal }, "worker shutting down after the current job");
      ctrl.abort();
    };
    process.on("SIGTERM", () => stop("SIGTERM"));
    process.on("SIGINT", () => stop("SIGINT"));
    await runPoller({ intervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000), signal: ctrl.signal });
    await db.$disconnect();
    process.exit(0);
  }

  const processor = async (job: Job<JobPayload>) => dispatch(job.data.processingJobId);
  const workers = [
    new Worker(QUEUE_NAMES.photo, processor, { connection, concurrency: e.WORKER_CONCURRENCY_PHOTO, lockDuration: 10 * 60_000 }),
    new Worker(QUEUE_NAMES.video, processor, { connection, concurrency: e.WORKER_CONCURRENCY_VIDEO, lockDuration: 30 * 60_000 }),
    new Worker(QUEUE_NAMES.delivery, processor, { connection, concurrency: 2, lockDuration: 30 * 60_000 }),
    new Worker(
      QUEUE_NAMES.maintenance,
      async (job: Job<{ deliveryId?: string }>) => {
        if (job.name === "cleanup-delivery" && job.data.deliveryId) return cleanupDelivery(job.data.deliveryId);
        const reports = await runDeliveryCleanup();
        if (reports.length) logger.info({ reports }, "expiration sweep");
        return reports.length;
      },
      { connection, concurrency: 1 },
    ),
  ];
  for (const w of workers) {
    w.on("failed", (job, err) => logger.warn({ queue: w.name, jobId: job?.id, err: err.message }, "job failed"));
    w.on("error", (err) => logger.error({ queue: w.name, err }, "worker error"));
  }

  // Expiration sweep every minute. Access is ALSO denied per-request, so a late
  // sweep never exposes an expired gallery.
  await getQueue(QUEUE_NAMES.maintenance).upsertJobScheduler("delivery-expiration-sweep", { every: 60_000 }, { name: "cleanup-sweep", data: {} });
  logger.info({ queues: Object.values(QUEUE_NAMES) }, "OCEANX worker started");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "worker shutting down");
    await Promise.all(workers.map((w) => w.close()));
    await closeRedis();
    await db.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "worker failed to start");
  process.exit(1);
});
