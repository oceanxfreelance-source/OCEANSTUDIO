import { mkdir, open, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { IntegrityError, ProcessingError } from "@/lib/errors";
import { formatForFilename, verifySignature } from "@/lib/file-types";
import { qualityLabel } from "@/lib/labels";
import { keys } from "@/lib/storage/keys";
import { storage } from "@/lib/storage/s3";
import { makeImagePreviews } from "@/services/image/previews";
import { img } from "@/services/image/sharp";
import { extractFaceRegions, readExif, summarize } from "@/services/metadata/exif";
import { rawProcessor } from "@/services/raw/libraw";
import { makeVideoPreviews, probeVideo } from "@/services/video/ffmpeg";
import { registerObject } from "@/server/storage-registry";
import { createVersion } from "@/server/versions";
import { downloadWithHash, type JobContext } from "../context";

/**
 * INGEST: staging upload → immutable master.
 *  1. server-side copy staging → projects/{p}/masters/{id} (only if absent)
 *  2. download the MASTER and compute the authoritative SHA-256
 *  3. inspect metadata (LibRaw/ExifTool/FFprobe)
 *  4. generate previews (never replacing the master)
 *  5. create the ORIGINAL version that references the master
 */
export async function ingest(ctx: JobContext): Promise<void> {
  const media = await db.mediaFile.findUniqueOrThrow({ where: { id: ctx.job.mediaId! } });
  if (media.status === "READY" && media.checksum) {
    ctx.log("already ingested — nothing to do (idempotent)");
    return;
  }
  const s = storage();
  const format = formatForFilename(media.filename);
  if (!format) throw new ProcessingError("Unsupported file type", media.filename, false);
  await db.mediaFile.update({ where: { id: media.id }, data: { status: "INGESTING" } });

  // 1. promote
  await ctx.progress(0.05, "Securing master");
  let masterHead = await s.head(media.storageKey);
  if (!masterHead) {
    if (!media.stagingKey || !(await s.head(media.stagingKey))) throw new ProcessingError("Upload not found in storage", media.stagingKey ?? "", false);
    await s.promoteToMaster(media.stagingKey, media.storageKey, media.mimeType);
    masterHead = await s.head(media.storageKey);
  }
  if (!masterHead || masterHead.size !== Number(media.size)) {
    throw new IntegrityError("Master copy does not match the uploaded size", `${masterHead?.size} vs ${media.size}`);
  }

  // 2. checksum of the master itself
  await ctx.progress(0.15, "Calculating SHA-256");
  const local = join(ctx.workDir, `master.${media.extension}`);
  const checksum = await downloadWithHash(media.storageKey, local);
  if (media.clientChecksum && media.clientChecksum !== checksum) {
    throw new IntegrityError("Upload corrupted in transit: SHA-256 differs from the browser's checksum", `${media.clientChecksum} vs ${checksum}`);
  }
  const headBytes = await readHead(local, 4096);
  if (!verifySignature(format, headBytes)) throw new ProcessingError(`File content is not a valid ${format.label}`, undefined, false);

  await db.mediaFile.update({ where: { id: media.id }, data: { checksum, etag: masterHead.etag, integrityStatus: "OK", integrityCheckedAt: new Date() } });
  await registerObject({ key: media.storageKey, category: "MASTER", size: masterHead.size, projectId: media.projectId, mediaId: media.id });
  if (media.stagingKey && (await s.head(media.stagingKey))) {
    await s.deleteTemporary([media.stagingKey], { stagingMediaId: media.id });
  }
  await db.mediaFile.update({ where: { id: media.id }, data: { stagingKey: null } });
  ctx.log(`master ${media.storageKey} sha256=${checksum}`);

  // 3 + 4. metadata & previews
  await ctx.progress(0.35, "Reading metadata");
  const previewDir = join(ctx.workDir, "previews");
  await mkdir(previewDir, { recursive: true });
  let dims: { width: number | null; height: number | null } = { width: null, height: null };
  const mediaUpdate: Prisma.MediaFileUpdateInput = {};
  const metadata: Prisma.MediaMetadataCreateWithoutMediaInput = {};
  const previewKeys: { previewKey?: string; thumbKey?: string; detailKey?: string } = {};

  const upload = async (localPath: string, key: string, contentType: string, category: "PREVIEW") => {
    await s.uploadFile(key, localPath, contentType);
    await registerObject({ key, category, size: (await stat(localPath)).size, projectId: media.projectId, mediaId: media.id });
  };

  if (media.mediaType === "RAW") {
    const raw = rawProcessor();
    const meta = await raw.extractMetadata({ path: local, extension: media.extension });
    dims = { width: meta.width, height: meta.height };
    Object.assign(metadata, {
      cameraMake: meta.cameraMake, cameraModel: meta.cameraModel, lens: meta.lens, iso: meta.iso, shutter: meta.shutter,
      aperture: meta.aperture, focalLength: meta.focalLength, faceRegions: meta.faceRegions as unknown as Prisma.InputJsonValue,
      exif: meta.exif as Prisma.InputJsonValue, raw: meta.raw as Prisma.InputJsonValue,
    });
    mediaUpdate.capturedAt = meta.capturedAt;
    await ctx.progress(0.55, "Generating RAW preview");
    const rawPreview = join(previewDir, "raw-preview.jpg");
    const pv = await raw.generatePreview({ path: local, extension: media.extension }, rawPreview);
    ctx.log(`raw preview from ${pv.source} ${pv.width}×${pv.height}`);
    await upload(rawPreview, keys.rawPreview(media.projectId, media.id), "image/jpeg", "PREVIEW");
    const set = await makeImagePreviews(rawPreview, previewDir);
    await upload(set.preview, keys.preview(media.projectId, media.id, "preview.jpg"), "image/jpeg", "PREVIEW");
    await upload(set.thumb, keys.preview(media.projectId, media.id, "thumb.jpg"), "image/jpeg", "PREVIEW");
    previewKeys.previewKey = keys.preview(media.projectId, media.id, "preview.jpg");
    previewKeys.thumbKey = keys.preview(media.projectId, media.id, "thumb.jpg");
  } else if (media.mediaType === "PHOTO") {
    const exif = await readExif(local);
    const sum = summarize(exif);
    const m = await img(local, false).metadata();
    const rotated = (m.orientation ?? 1) >= 5;
    dims = { width: rotated ? m.height! : m.width!, height: rotated ? m.width! : m.height! };
    Object.assign(metadata, {
      cameraMake: sum.cameraMake, cameraModel: sum.cameraModel, lens: sum.lens, iso: sum.iso, shutter: sum.shutter,
      aperture: sum.aperture, focalLength: sum.focalLength,
      faceRegions: extractFaceRegions(exif) as unknown as Prisma.InputJsonValue, exif: exif as Prisma.InputJsonValue,
    });
    mediaUpdate.capturedAt = sum.capturedAt;
    mediaUpdate.colorInfo = { space: m.space ?? null, depth: m.depth ?? null, hasProfile: Boolean(m.icc), channels: m.channels ?? null };
    await ctx.progress(0.55, "Generating previews");
    const set = await makeImagePreviews(local, previewDir, false);
    await upload(set.preview, keys.preview(media.projectId, media.id, "preview.jpg"), "image/jpeg", "PREVIEW");
    await upload(set.thumb, keys.preview(media.projectId, media.id, "thumb.jpg"), "image/jpeg", "PREVIEW");
    previewKeys.previewKey = keys.preview(media.projectId, media.id, "preview.jpg");
    previewKeys.thumbKey = keys.preview(media.projectId, media.id, "thumb.jpg");
    if (set.detail) {
      await upload(set.detail, keys.preview(media.projectId, media.id, "detail.jpg"), "image/jpeg", "PREVIEW");
      previewKeys.detailKey = keys.preview(media.projectId, media.id, "detail.jpg");
    }
  } else {
    const probe = await probeVideo(local);
    const exif = await readExif(local);
    const sum = summarize(exif);
    dims = { width: probe.displayWidth, height: probe.displayHeight };
    Object.assign(mediaUpdate, {
      duration: probe.duration, fps: probe.fps, codec: probe.codec, bitrate: probe.bitrate ? BigInt(Math.round(probe.bitrate)) : null,
      audioCodec: probe.audioCodec, container: probe.container,
      colorInfo: { ...probe.color, pixFmt: probe.pixFmt, rotation: probe.rotation },
      capturedAt: sum.capturedAt ?? (probe.creationTime ? new Date(probe.creationTime) : null),
    });
    Object.assign(metadata, { cameraMake: sum.cameraMake, cameraModel: sum.cameraModel, exif: exif as Prisma.InputJsonValue, probe: probe.raw as Prisma.InputJsonValue });
    await ctx.progress(0.5, "Generating video proxy");
    const pv = await makeVideoPreviews(local, previewDir, probe);
    await upload(pv.proxy, keys.preview(media.projectId, media.id, "proxy.mp4"), "video/mp4", "PREVIEW");
    await upload(pv.poster, keys.preview(media.projectId, media.id, "poster.jpg"), "image/jpeg", "PREVIEW");
    await upload(pv.thumb, keys.preview(media.projectId, media.id, "thumb.jpg"), "image/jpeg", "PREVIEW");
    previewKeys.previewKey = keys.preview(media.projectId, media.id, "proxy.mp4");
    previewKeys.thumbKey = keys.preview(media.projectId, media.id, "thumb.jpg");
    previewKeys.detailKey = keys.preview(media.projectId, media.id, "poster.jpg");
  }

  await ctx.progress(0.9, "Registering master");
  await db.$transaction(async (tx) => {
    await tx.mediaFile.update({
      where: { id: media.id },
      data: { ...mediaUpdate, width: dims.width, height: dims.height, ...previewKeys, status: "READY", errorMessage: null },
    });
    await tx.mediaMetadata.upsert({ where: { mediaId: media.id }, create: { mediaId: media.id, ...metadata }, update: metadata });
  });
  const fresh = await db.mediaFile.findUniqueOrThrow({ where: { id: media.id } });
  await createVersion({
    id: `${media.id}o`.slice(0, 64),
    mediaId: media.id,
    projectId: media.projectId,
    versionType: "ORIGINAL",
    label: qualityLabel({ versionType: "ORIGINAL", mediaType: media.mediaType, isAi: false }),
    storageKey: media.storageKey,
    previewKey: fresh.previewKey,
    thumbKey: fresh.thumbKey,
    detailKey: fresh.detailKey,
    filename: media.filename,
    mimeType: media.mimeType,
    size: media.size,
    width: fresh.width,
    height: fresh.height,
    duration: fresh.duration,
    bitrate: fresh.bitrate,
    fps: fresh.fps,
    checksum,
    isMasterRef: true,
    processingJobId: ctx.job.id,
  });
  await db.project.updateMany({ where: { id: media.projectId, status: "DRAFT" }, data: { status: "READY" } });
  await audit({ action: "INTEGRITY_VERIFIED", actorType: "SYSTEM", projectId: media.projectId, mediaId: media.id, details: { checksum, stage: "ingest" } });
}

async function readHead(path: string, n: number): Promise<Buffer> {
  const fh = await open(path, "r");
  try {
    const buf = Buffer.alloc(n);
    const { bytesRead } = await fh.read(buf, 0, n, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}
