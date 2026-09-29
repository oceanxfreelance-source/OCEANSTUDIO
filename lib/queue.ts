import { Queue } from "bullmq";
import type { JobType, MediaType } from "@prisma/client";
import { getRedis } from "./redis";
import { AppError } from "./errors";

export const QUEUE_NAMES = {
  photo: "oceanx-photo",
  video: "oceanx-video",
  delivery: "oceanx-delivery",
  maintenance: "oceanx-maintenance",
} as const;
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface JobPayload {
  processingJobId: string;
}

const queues = new Map<string, Queue>();

export function getQueue(name: QueueName): Queue {
  const connection = getRedis();
  if (!connection) {
    throw new AppError(503, "QUEUE_UNAVAILABLE", "The processing queue is not configured (set REDIS_URL).");
  }
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, { connection, defaultJobOptions: { removeOnComplete: 1000, removeOnFail: 5000 } });
    queues.set(name, q);
  }
  return q;
}

export function queueFor(jobType: JobType, mediaType?: MediaType | null): QueueName {
  switch (jobType) {
    case "VIDEO_ENHANCE":
      return QUEUE_NAMES.video;
    case "INGEST":
    case "VERIFY_MASTER":
      return mediaType === "VIDEO" ? QUEUE_NAMES.video : QUEUE_NAMES.photo;
    case "DELIVERY_PREPARE":
    case "ZIP_PACKAGE":
      return QUEUE_NAMES.delivery;
    default:
      return QUEUE_NAMES.photo;
  }
}

/** True when jobs are dispatched through Redis/BullMQ; false = the worker polls Postgres. */
export function usesRedisQueue(): boolean {
  return getRedis() !== null;
}

/**
 * Enqueue a processing job. The database row (status QUEUED) is the source of
 * truth; with Redis the queue only carries its id for instant pickup. Without
 * Redis this is a no-op and the worker's Postgres poller claims the row.
 * Retries use a new BullMQ job id per attempt.
 */
export async function enqueue(job: { id: string; jobType: JobType; attempts: number }, mediaType?: MediaType | null) {
  if (!usesRedisQueue()) return;
  const q = getQueue(queueFor(job.jobType, mediaType));
  await q.add(job.jobType, { processingJobId: job.id } satisfies JobPayload, {
    jobId: `${job.id}-a${job.attempts}`,
    attempts: 1, // retries are explicit (admin "Retry") so they are visible and audited
  });
}

export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((q) => q.close()));
  queues.clear();
}
