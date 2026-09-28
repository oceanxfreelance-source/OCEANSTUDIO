import type { JobStatus, Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/errors";
import { enqueue } from "@/lib/queue";

export async function listJobs(opts: { status?: JobStatus; take?: number } = {}) {
  return db.processingJob.findMany({
    where: opts.status ? { status: opts.status } : {},
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 200,
    include: { media: { select: { id: true, filename: true, mediaType: true } }, delivery: { select: { id: true, title: true } } },
  });
}

export async function getJob(id: string) {
  const job = await db.processingJob.findUnique({ where: { id }, include: { media: { select: { id: true, filename: true } } } });
  if (!job) throw notFound("Job not found");
  return job;
}

/**
 * Retry a failed/cancelled job. The same job row is re-queued; its output is
 * keyed by the job id so a retry can never create a duplicate master or
 * version (see server/versions.ts).
 */
export async function retryJob(id: string, adminId: string) {
  const job = await getJob(id);
  if (job.status !== "FAILED" && job.status !== "CANCELLED") throw conflict("Only failed or cancelled jobs can be retried");
  const updated = await db.processingJob.update({
    where: { id },
    data: { status: "QUEUED", progress: 0, errorMessage: null, stage: "Queued (retry)", attempts: { increment: 1 }, startedAt: null, completedAt: null },
    include: { media: { select: { mediaType: true } } },
  });
  if (job.jobType === "INGEST" && job.mediaId) {
    await db.mediaFile.updateMany({ where: { id: job.mediaId, status: "FAILED" }, data: { status: "UPLOADED", errorMessage: null } });
  }
  await enqueue(updated, updated.media?.mediaType);
  await audit({ action: "PROCESSING_RETRIED", actorType: "ADMIN", actorId: adminId, projectId: job.projectId, mediaId: job.mediaId, details: { jobId: id, attempt: updated.attempts } });
  return updated;
}

export async function cancelJob(id: string, adminId: string) {
  const job = await getJob(id);
  if (job.status !== "QUEUED" && job.status !== "PROCESSING") throw conflict("Job is not running");
  const updated = await db.processingJob.update({ where: { id }, data: { status: "CANCELLED", completedAt: new Date(), stage: "Cancelled" } });
  await audit({ action: "PROCESSING_CANCELLED", actorType: "ADMIN", actorId: adminId, projectId: job.projectId, mediaId: job.mediaId, details: { jobId: id } as Prisma.InputJsonValue });
  return updated;
}
