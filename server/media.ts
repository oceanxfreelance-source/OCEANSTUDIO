import type { JobType, Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { photoJobSettingsSchema, videoJobSettingsSchema, type PhotoJobSettings, type VideoJobSettings } from "@/lib/processing/settings";
import { enqueue } from "@/lib/queue";
import { storage } from "@/lib/storage/s3";
import { newId } from "@/lib/ids";

export async function listMedia(projectId: string) {
  return db.mediaFile.findMany({
    where: { projectId },
    orderBy: [{ capturedAt: "asc" }, { filename: "asc" }],
    include: {
      versions: { orderBy: { versionNumber: "asc" } },
      _count: { select: { favorites: true } },
    },
  });
}

export async function getMedia(id: string) {
  const media = await db.mediaFile.findUnique({
    where: { id },
    include: {
      metadata: true,
      project: { select: { id: true, name: true } },
      versions: { orderBy: { versionNumber: "asc" } },
      jobs: { orderBy: { createdAt: "desc" }, take: 20 },
      _count: { select: { favorites: true } },
    },
  });
  if (!media) throw notFound("File not found");
  return media;
}

/** Signed URLs for the admin viewer (previews + full-resolution inspection image). */
export async function signedVersionAssets(v: { previewKey: string | null; thumbKey: string | null; detailKey: string | null }) {
  const s = storage();
  const ttl = env().PREVIEW_URL_TTL_SECONDS;
  return {
    previewUrl: v.previewKey ? await s.presignGet(v.previewKey, { expiresIn: ttl }) : null,
    thumbUrl: v.thumbKey ? await s.presignGet(v.thumbKey, { expiresIn: ttl }) : null,
    detailUrl: v.detailKey ? await s.presignGet(v.detailKey, { expiresIn: ttl }) : null,
  };
}

export async function setPublished(versionId: string, published: boolean, adminId: string) {
  const v = await db.mediaVersion.findUnique({ where: { id: versionId }, include: { media: { select: { status: true } } } });
  if (!v) throw notFound("Version not found");
  if (published && v.media.status !== "READY") throw conflict("File is not ready");
  const updated = await db.mediaVersion.update({ where: { id: versionId }, data: { published, publishedAt: published ? new Date() : null } });
  await audit({
    action: published ? "FILE_PUBLISHED" : "FILE_UNPUBLISHED",
    actorType: "ADMIN",
    actorId: adminId,
    projectId: v.projectId,
    mediaId: v.mediaId,
    details: { versionId, label: v.label, filename: v.filename },
  });
  return updated;
}

/** Publish/unpublish every version selected by the admin for a media file (API: /api/admin/media/[id]/publish). */
export async function publishMediaVersion(mediaId: string, versionId: string | undefined, published: boolean, adminId: string) {
  const media = await db.mediaFile.findUnique({ where: { id: mediaId }, include: { versions: true } });
  if (!media) throw notFound("File not found");
  const target = versionId ? media.versions.find((v) => v.id === versionId) : media.versions.at(-1);
  if (!target) throw notFound("Version not found for this file");
  return setPublished(target.id, published, adminId);
}

async function createJob(data: {
  jobType: JobType;
  mediaId: string;
  projectId: string;
  sourceVersionId: string;
  settings: Prisma.InputJsonValue;
  adminId: string;
  batchId?: string;
  inputStorageKey: string;
}) {
  const job = await db.processingJob.create({
    data: {
      jobType: data.jobType,
      mediaId: data.mediaId,
      projectId: data.projectId,
      sourceVersionId: data.sourceVersionId,
      settings: data.settings,
      createdById: data.adminId,
      batchId: data.batchId ?? null,
      inputStorageKey: data.inputStorageKey,
    },
  });
  await db.project.updateMany({ where: { id: data.projectId, status: { in: ["DRAFT", "READY"] } }, data: { status: "PROCESSING" } });
  await enqueue(job);
  return job;
}

async function sourceFor(versionId: string) {
  const v = await db.mediaVersion.findUnique({ where: { id: versionId }, include: { media: true } });
  if (!v) throw notFound("Source version not found");
  if (v.media.status !== "READY") throw conflict("File is still being ingested");
  return v;
}

export function photoJobType(s: PhotoJobSettings): JobType {
  if (s.enhance) return "PHOTO_ENHANCE";
  if (s.raw && !s.color) return "RAW_DEVELOP";
  if (s.raw) return "RAW_DEVELOP";
  return "COLOR_GRADE";
}

export async function queuePhotoJob(raw: unknown, adminId: string) {
  const settings = photoJobSettingsSchema.parse(raw);
  const v = await sourceFor(settings.sourceVersionId);
  if (v.media.mediaType === "VIDEO") throw badRequest("Use video processing for video files");
  const job = await createJob({
    jobType: photoJobType(settings),
    mediaId: v.mediaId,
    projectId: v.projectId,
    sourceVersionId: v.id,
    settings: settings as unknown as Prisma.InputJsonValue,
    adminId,
    inputStorageKey: v.storageKey,
  });
  await audit({ action: "PROCESSING_STARTED", actorType: "ADMIN", actorId: adminId, projectId: v.projectId, mediaId: v.mediaId, details: { jobId: job.id, type: job.jobType } });
  return job;
}

/** Batch color grading / processing: one job per selected version, all creating new derivatives. */
export async function queueBatchPhotoJobs(versionIds: string[], template: Omit<PhotoJobSettings, "sourceVersionId">, adminId: string) {
  if (versionIds.length === 0) throw badRequest("Select at least one photo");
  if (versionIds.length > 1000) throw badRequest("Batch limit is 1000 photos");
  const batchId = newId();
  const jobs = [];
  for (const id of versionIds) jobs.push(await queuePhotoJobWithBatch({ ...template, sourceVersionId: id }, adminId, batchId));
  return { batchId, jobs };
}

async function queuePhotoJobWithBatch(raw: unknown, adminId: string, batchId: string) {
  const settings = photoJobSettingsSchema.parse(raw);
  const v = await sourceFor(settings.sourceVersionId);
  if (v.media.mediaType === "VIDEO") throw badRequest(`${v.filename} is a video`);
  return createJob({
    jobType: photoJobType(settings),
    mediaId: v.mediaId,
    projectId: v.projectId,
    sourceVersionId: v.id,
    settings: settings as unknown as Prisma.InputJsonValue,
    adminId,
    batchId,
    inputStorageKey: v.storageKey,
  });
}

export async function queueVideoJob(raw: unknown, adminId: string) {
  const settings: VideoJobSettings = videoJobSettingsSchema.parse(raw);
  const v = await sourceFor(settings.sourceVersionId);
  if (v.media.mediaType !== "VIDEO") throw badRequest("Not a video");
  const job = await createJob({
    jobType: "VIDEO_ENHANCE",
    mediaId: v.mediaId,
    projectId: v.projectId,
    sourceVersionId: v.id,
    settings: settings as unknown as Prisma.InputJsonValue,
    adminId,
    inputStorageKey: v.storageKey,
  });
  await audit({ action: "PROCESSING_STARTED", actorType: "ADMIN", actorId: adminId, projectId: v.projectId, mediaId: v.mediaId, details: { jobId: job.id, type: job.jobType } });
  return job;
}

export async function queueVerifyMaster(mediaId: string, adminId: string) {
  const media = await db.mediaFile.findUnique({ where: { id: mediaId } });
  if (!media) throw notFound("File not found");
  if (!media.checksum) throw conflict("File has not been ingested yet");
  const job = await db.processingJob.create({ data: { jobType: "VERIFY_MASTER", mediaId, projectId: media.projectId, createdById: adminId, inputStorageKey: media.storageKey } });
  await enqueue(job, media.mediaType);
  return job;
}

/** Admin download of any version, including the untouched master (signed, short-lived). */
export async function adminDownloadUrl(versionId: string, adminId: string) {
  const v = await db.mediaVersion.findUnique({ where: { id: versionId } });
  if (!v) throw notFound("Version not found");
  const url = await storage().presignGet(v.storageKey, { expiresIn: env().DOWNLOAD_URL_TTL_SECONDS, downloadFilename: v.filename, contentType: v.mimeType });
  await db.download.create({ data: { mediaId: v.mediaId, versionId: v.id, downloadType: v.isMasterRef ? "ADMIN_MASTER" : "ADMIN_VERSION", label: v.label } });
  await audit({ action: "ADMIN_DOWNLOAD", actorType: "ADMIN", actorId: adminId, projectId: v.projectId, mediaId: v.mediaId, details: { versionId, filename: v.filename } });
  return { url, filename: v.filename };
}
