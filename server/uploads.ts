import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { formatForFilename, sanitizeFilename, verifySignature, FORMATS } from "@/lib/file-types";
import { newId } from "@/lib/ids";
import { enqueue } from "@/lib/queue";
import { keys } from "@/lib/storage/keys";
import { storage } from "@/lib/storage/s3";

export const MAX_PARTS = 10_000;

export const createUploadSchema = z.object({
  projectId: z.string().min(1).max(64),
  filename: z.string().min(1).max(255),
  size: z.number().int().positive(),
  mimeType: z.string().max(200).optional(),
  clientChecksum: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  lastModified: z.number().int().optional(),
});

export function partSizeFor(size: number): number {
  const base = env().UPLOAD_PART_SIZE;
  const min = Math.ceil(size / MAX_PARTS);
  return Math.max(base, Math.ceil(min / (1024 * 1024)) * 1024 * 1024);
}

/**
 * Step 1 of a direct browser → storage multipart upload. Nothing large ever
 * passes through the web server. The upload lands in a staging key; only after
 * validation does the worker promote it to the immutable master key.
 */
export async function createUpload(input: z.infer<typeof createUploadSchema>, adminId: string) {
  const project = await db.project.findUnique({ where: { id: input.projectId } });
  if (!project) throw notFound("Project not found");
  if (project.status === "ARCHIVED") throw conflict("Project is archived");

  const filename = sanitizeFilename(input.filename);
  const format = formatForFilename(filename);
  if (!format) {
    throw badRequest(`Unsupported file type. Supported: ${[...new Set(FORMATS.map((f) => f.ext.toUpperCase()))].join(", ")}`);
  }
  if (input.size > env().MAX_UPLOAD_BYTES) throw badRequest("File exceeds the maximum upload size");

  const mediaId = newId();
  const stagingKey = keys.staging(mediaId);
  const masterKey = keys.master(project.id, mediaId);
  const uploadId = await storage().createMultipartUpload(stagingKey, format.mime, {
    "media-id": mediaId,
    "original-filename": encodeURIComponent(filename),
  });
  const partSize = partSizeFor(input.size);
  const partCount = Math.ceil(input.size / partSize);

  await db.mediaFile.create({
    data: {
      id: mediaId,
      projectId: project.id,
      filename,
      extension: format.ext,
      mediaType: format.mediaType,
      mimeType: format.mime,
      size: BigInt(input.size),
      storageKey: masterKey,
      stagingKey,
      uploadId,
      clientChecksum: input.clientChecksum ?? null,
      status: "UPLOADING",
    },
  });

  return { mediaId, uploadId, partSize, partCount, mediaType: format.mediaType, createdBy: adminId };
}

async function uploadingMedia(mediaId: string) {
  const media = await db.mediaFile.findUnique({ where: { id: mediaId } });
  if (!media) throw notFound("Upload not found");
  if (media.status !== "UPLOADING" || !media.uploadId || !media.stagingKey) throw conflict("Upload is not in progress");
  return media as typeof media & { uploadId: string; stagingKey: string };
}

export async function signParts(mediaId: string, partNumbers: number[]) {
  const media = await uploadingMedia(mediaId);
  const partSize = partSizeFor(Number(media.size));
  const partCount = Math.ceil(Number(media.size) / partSize);
  const urls: Record<number, string> = {};
  for (const n of partNumbers) {
    if (!Number.isInteger(n) || n < 1 || n > partCount) throw badRequest(`Invalid part number ${n}`);
    urls[n] = await storage().presignUploadPart(media.stagingKey, media.uploadId, n, 3600);
  }
  return { urls, partSize, partCount };
}

/** Resume support: which parts already reached storage. */
export async function uploadedParts(mediaId: string) {
  const media = await uploadingMedia(mediaId);
  const parts = await storage().listParts(media.stagingKey, media.uploadId);
  const partSize = partSizeFor(Number(media.size));
  return { parts, partSize, partCount: Math.ceil(Number(media.size) / partSize), uploadId: media.uploadId };
}

export const completeUploadSchema = z.object({
  mediaId: z.string().min(1).max(64),
  parts: z.array(z.object({ partNumber: z.number().int().min(1).max(MAX_PARTS), etag: z.string().min(1).max(200) })).min(1),
});

export async function completeUpload(input: z.infer<typeof completeUploadSchema>, adminId: string, ipHash: string | null) {
  const media = await uploadingMedia(input.mediaId);
  const s = storage();
  await s.completeMultipartUpload(
    media.stagingKey,
    media.uploadId,
    input.parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
  );

  const head = await s.head(media.stagingKey);
  const format = formatForFilename(media.filename)!;
  const reject = async (reason: string) => {
    await s.deleteTemporary([media.stagingKey], { stagingMediaId: media.id }).catch(() => undefined);
    await db.mediaFile.update({ where: { id: media.id }, data: { status: "FAILED", errorMessage: reason, uploadId: null } });
    await audit({ action: "UPLOAD_REJECTED", actorType: "ADMIN", actorId: adminId, projectId: media.projectId, mediaId: media.id, details: { reason }, ipHash });
    throw badRequest(reason);
  };
  if (!head) return reject("Upload did not reach storage");
  if (head.size !== Number(media.size)) return reject(`Size mismatch: expected ${media.size} bytes, storage has ${head.size}`);
  const leading = await s.getRange(media.stagingKey, 0, Math.min(head.size, 4096) - 1);
  if (!verifySignature(format, leading)) return reject(`File content does not match a valid ${format.label} file`);

  const job = await db.$transaction(async (tx) => {
    await tx.mediaFile.update({
      where: { id: media.id },
      data: { status: "UPLOADED", uploadId: null, uploadedAt: new Date(), etag: head.etag },
    });
    return tx.processingJob.create({
      data: {
        jobType: "INGEST",
        mediaId: media.id,
        projectId: media.projectId,
        inputStorageKey: media.stagingKey,
        outputStorageKey: media.storageKey,
        createdById: adminId,
      },
    });
  });
  await audit({
    action: "FILE_UPLOADED",
    actorType: "ADMIN",
    actorId: adminId,
    projectId: media.projectId,
    mediaId: media.id,
    details: { filename: media.filename, size: Number(media.size), mediaType: media.mediaType },
    ipHash,
  });
  await enqueue(job, media.mediaType);
  return { mediaId: media.id, jobId: job.id, status: "UPLOADED" as const };
}

export async function abortUpload(mediaId: string) {
  const media = await uploadingMedia(mediaId);
  await storage().abortMultipartUpload(media.stagingKey, media.uploadId).catch(() => undefined);
  await db.mediaFile.delete({ where: { id: media.id } });
  return { aborted: true };
}
