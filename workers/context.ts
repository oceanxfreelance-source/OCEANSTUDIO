import { createHash } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProcessingJob } from "@prisma/client";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { IntegrityError, ProcessingError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { storage } from "@/lib/storage/s3";

export interface JobContext {
  job: ProcessingJob;
  workDir: string;
  log: (line: string) => void;
  progress: (fraction: number, stage?: string) => Promise<void>;
  technicalLog: () => string;
}

export async function makeWorkDir(jobId: string): Promise<string> {
  const base = env().WORKER_TMP_DIR ?? join(tmpdir(), "oceanx");
  const dir = join(base, jobId);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Wrap a handler with the job lifecycle: QUEUED → PROCESSING → COMPLETED/FAILED,
 * progress reporting, human + technical error messages, audit entries and
 * scratch-space cleanup. A cancelled job is never started.
 */
export async function runJob(processingJobId: string, handler: (ctx: JobContext) => Promise<void>): Promise<void> {
  const job = await db.processingJob.findUnique({ where: { id: processingJobId } });
  if (!job) {
    logger.warn({ processingJobId }, "job row missing; skipping");
    return;
  }
  if (job.status === "CANCELLED" || job.status === "COMPLETED") return;
  const claimed = await db.processingJob.updateMany({
    where: { id: job.id, status: { in: ["QUEUED", "PROCESSING"] } },
    data: { status: "PROCESSING", startedAt: new Date(), progress: 0, errorMessage: null, stage: "Starting" },
  });
  if (claimed.count === 0) return;

  const lines: string[] = [];
  const log = (line: string) => {
    lines.push(`[${new Date().toISOString()}] ${line}`);
    if (lines.length > 400) lines.splice(0, lines.length - 400);
    logger.debug({ jobId: job.id }, line);
  };
  let lastWrite = 0;
  const progress = async (fraction: number, stage?: string) => {
    const pct = Math.max(0, Math.min(99, Math.round(fraction * 100)));
    if (stage) log(`stage: ${stage}`);
    const t = Date.now();
    if (t - lastWrite < 750 && !stage) return;
    lastWrite = t;
    await db.processingJob.update({ where: { id: job.id }, data: { progress: pct, ...(stage ? { stage } : {}) } }).catch(() => undefined);
  };
  const workDir = await makeWorkDir(job.id);
  const ctx: JobContext = { job, workDir, log, progress, technicalLog: () => lines.join("\n") };
  const isDeliveryJob = job.jobType === "DELIVERY_PREPARE" || job.jobType === "ZIP_PACKAGE";

  try {
    if (!isDeliveryJob && job.jobType !== "INGEST" && job.jobType !== "VERIFY_MASTER") {
      await audit({ action: "PROCESSING_STARTED", actorType: "SYSTEM", projectId: job.projectId, mediaId: job.mediaId, details: { jobId: job.id, type: job.jobType } });
    }
    await handler(ctx);
    const current = await db.processingJob.findUnique({ where: { id: job.id }, select: { status: true } });
    if (current?.status === "CANCELLED") return;
    await db.processingJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", progress: 100, stage: "Done", completedAt: new Date(), technicalLog: ctx.technicalLog().slice(-20000) },
    });
    if (!isDeliveryJob && job.jobType !== "INGEST") {
      await audit({ action: "PROCESSING_COMPLETED", actorType: "SYSTEM", projectId: job.projectId, mediaId: job.mediaId, details: { jobId: job.id, type: job.jobType } });
    }
  } catch (err) {
    const human =
      err instanceof ProcessingError ? err.humanMessage : "Processing failed unexpectedly. See the technical log for details.";
    const technical = [ctx.technicalLog(), err instanceof ProcessingError ? err.technical ?? "" : "", err instanceof Error ? err.stack ?? err.message : String(err)]
      .filter(Boolean)
      .join("\n---\n");
    logger.error({ err, jobId: job.id, type: job.jobType }, "job failed");
    await db.processingJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: human, technicalLog: technical.slice(-20000), completedAt: new Date() },
    });
    if (job.jobType === "INGEST" && job.mediaId) {
      await db.mediaFile.update({ where: { id: job.mediaId }, data: { status: "FAILED", errorMessage: human } }).catch(() => undefined);
    }
    if (job.jobType === "DELIVERY_PREPARE" && job.deliveryId) {
      await db.delivery.updateMany({ where: { id: job.deliveryId, status: "PREPARING" }, data: { status: "FAILED" } });
    }
    if (job.jobType === "ZIP_PACKAGE" && job.deliveryId) {
      await db.deliveryPackage.updateMany({ where: { deliveryId: job.deliveryId, status: "BUILDING" }, data: { status: "FAILED" } });
    }
    await audit({
      action: err instanceof IntegrityError ? "INTEGRITY_ALERT" : "PROCESSING_FAILED",
      actorType: "SYSTEM",
      projectId: job.projectId,
      mediaId: job.mediaId,
      deliveryId: job.deliveryId,
      details: { jobId: job.id, type: job.jobType, error: human },
    });
    throw err;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    await storage().deleteTemporaryPrefix(`processing/${job.id}/`, { jobId: job.id }).catch(() => undefined);
  }
}

/** Download an object to disk while computing its SHA-256. */
export async function downloadWithHash(key: string, path: string): Promise<string> {
  const hash = createHash("sha256");
  await storage().downloadToFile(key, path, (chunk) => hash.update(chunk));
  return hash.digest("hex");
}

/** Stream-hash an object without writing it to disk. */
export async function hashObject(key: string): Promise<string> {
  const hash = createHash("sha256");
  const body = await storage().getStream(key);
  for await (const chunk of body) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

/**
 * MASTER FILES ARE SACRED: before finalizing, confirm the master still has
 * the checksum recorded at upload. Any mismatch fails the job and raises an
 * INTEGRITY_ALERT for the admin.
 */
export async function verifyMasterIntegrity(mediaId: string, log: (l: string) => void, opts: { fullHashMaxBytes?: number } = {}) {
  const media = await db.mediaFile.findUniqueOrThrow({ where: { id: mediaId } });
  if (!media.checksum) throw new IntegrityError("Master has no recorded checksum; ingest has not completed.");
  const head = await storage().head(media.storageKey);
  if (!head) {
    await db.mediaFile.update({ where: { id: mediaId }, data: { integrityStatus: "MISMATCH", integrityCheckedAt: new Date() } });
    throw new IntegrityError("MASTER FILE MISSING — processing stopped. The admin has been alerted.", media.storageKey);
  }
  let ok = head.size === Number(media.size) && (!media.etag || head.etag === media.etag);
  let method = "size+etag";
  if (ok && Number(media.size) <= (opts.fullHashMaxBytes ?? 4 * 1024 ** 3)) {
    ok = (await hashObject(media.storageKey)) === media.checksum;
    method = "sha256";
  }
  log(`master integrity (${method}): ${ok ? "OK" : "MISMATCH"}`);
  await db.mediaFile.update({ where: { id: mediaId }, data: { integrityStatus: ok ? "OK" : "MISMATCH", integrityCheckedAt: new Date() } });
  if (!ok) throw new IntegrityError("MASTER CHECKSUM CHANGED — processing stopped. The admin has been alerted.", media.storageKey);
}

/** SHA-256 of a local file (streamed). */
export async function hashLocalFile(path: string): Promise<string> {
  const { createReadStream } = await import("node:fs");
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}
