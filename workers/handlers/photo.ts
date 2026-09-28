import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { IntegrityError, ProcessingError } from "@/lib/errors";
import { stem } from "@/lib/file-types";
import { newId } from "@/lib/ids";
import { qualityLabel } from "@/lib/labels";
import { photoJobSettingsSchema } from "@/lib/processing/settings";
import { keys } from "@/lib/storage/keys";
import { storage } from "@/lib/storage/s3";
import { imageProvider } from "@/services/ai";
import { runPhotoPipeline, type PhotoPipelineResult } from "@/services/image/pipeline";
import { makeImagePreviews } from "@/services/image/previews";
import type { FaceRegion } from "@/services/raw/types";
import { rawProcessor } from "@/services/raw/libraw";
import { registerObject } from "@/server/storage-registry";
import { createVersion } from "@/server/versions";
import { downloadWithHash, hashLocalFile, verifyMasterIntegrity, type JobContext } from "../context";

export function derivativeFilename(original: string, r: Pick<PhotoPipelineResult, "scale" | "isAi" | "versionType" | "colorPreset" | "extension">): string {
  const parts = [stem(original)];
  if (r.versionType === "RAW_DEVELOPED") parts.push("developed");
  if (r.scale > 1) parts.push(`${r.scale}x`);
  if (r.versionType === "AI_ENHANCED" || r.versionType === "ENHANCED") parts.push(r.isAi ? "ai-enhanced" : "enhanced");
  if (r.versionType === "UPSCALED" && r.scale <= 1) parts.push("upscaled");
  if (r.colorPreset) parts.push(r.colorPreset.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
  else if (r.versionType === "COLOR_GRADED") parts.push("graded");
  return `${parts.join("_")}.${r.extension}`;
}

/** RAW_DEVELOP, PHOTO_ENHANCE and COLOR_GRADE all run through the photo pipeline and create a NEW version. */
export async function processPhoto(ctx: JobContext): Promise<void> {
  const settings = photoJobSettingsSchema.parse(ctx.job.settings);
  const media = await db.mediaFile.findUniqueOrThrow({ where: { id: ctx.job.mediaId! }, include: { metadata: true } });
  if (media.mediaType === "VIDEO") throw new ProcessingError("This is a video; use Video AI", undefined, false);
  if (media.status !== "READY") throw new ProcessingError("Master is not ingested yet", media.status, false);
  const source = await db.mediaVersion.findFirst({ where: { id: settings.sourceVersionId, mediaId: media.id } });
  if (!source) throw new ProcessingError("Source version not found for this file", settings.sourceVersionId, false);

  // Download the source. When it IS the master, the SHA-256 is verified on the fly.
  await ctx.progress(0.01, "Fetching source");
  const srcExt = source.isMasterRef ? media.extension : source.filename.split(".").pop() ?? "tif";
  const srcPath = join(ctx.workDir, `source.${srcExt}`);
  const hash = await downloadWithHash(source.storageKey, srcPath);
  const expected = source.checksum ?? (source.isMasterRef ? media.checksum : null);
  if (expected && hash !== expected) {
    if (source.isMasterRef) await db.mediaFile.update({ where: { id: media.id }, data: { integrityStatus: "MISMATCH", integrityCheckedAt: new Date() } });
    throw new IntegrityError("Source file checksum changed — processing stopped. The admin has been alerted.", `${expected} vs ${hash}`);
  }

  const developRaw = media.mediaType === "RAW" && source.isMasterRef;
  if (settings.raw && !developRaw) ctx.log("RAW settings ignored: source is not the RAW master");
  const result = await runPhotoPipeline({
    sourcePath: srcPath,
    sourceExtension: srcExt,
    developRaw,
    settings,
    workDir: ctx.workDir,
    jobId: ctx.job.id,
    faceRegions: (media.metadata?.faceRegions as FaceRegion[] | null) ?? [],
    metadataSource: srcPath,
    provider: imageProvider(),
    rawProcessor: rawProcessor(),
    log: ctx.log,
    progress: (f, stage) => ctx.progress(f, stage),
  });
  for (const w of result.warnings) ctx.log(`warning: ${w}`);

  // Master must be untouched before we finalize anything.
  await ctx.progress(0.93, "Verifying master integrity");
  await verifyMasterIntegrity(media.id, ctx.log);

  await ctx.progress(0.95, "Saving new version");
  const versionId = newId();
  const s = storage();
  const outKey = keys.version(media.projectId, media.id, versionId);
  const filename = derivativeFilename(media.filename, result);
  const outHash = await hashLocalFile(result.path);
  await s.uploadFile(outKey, result.path, result.mimeType, filename);
  const uploaded = await s.head(outKey);
  if (!uploaded || uploaded.size !== result.size) throw new ProcessingError("Storage failed: derivative upload incomplete", outKey);
  await registerObject({ key: outKey, category: "DERIVATIVE", size: result.size, projectId: media.projectId, mediaId: media.id, versionId });

  const pdir = join(ctx.workDir, "vp");
  await mkdir(pdir, { recursive: true });
  const pv = await makeImagePreviews(result.path, pdir);
  const up = async (local: string, variant: "preview.jpg" | "thumb.jpg" | "detail.jpg") => {
    const key = keys.versionPreview(media.projectId, versionId, variant);
    await s.uploadFile(key, local, "image/jpeg");
    await registerObject({ key, category: "PREVIEW", size: (await stat(local)).size, projectId: media.projectId, mediaId: media.id, versionId });
    return key;
  };
  const previewKey = await up(pv.preview, "preview.jpg");
  const thumbKey = await up(pv.thumb, "thumb.jpg");
  const detailKey = pv.detail ? await up(pv.detail, "detail.jpg") : null;

  const version = await createVersion({
    id: versionId,
    mediaId: media.id,
    projectId: media.projectId,
    versionType: result.versionType,
    label: qualityLabel({ versionType: result.versionType, mediaType: media.mediaType, isAi: result.isAi, scale: result.scale, colorPreset: result.colorPreset }),
    engine: result.engines.join(" + "),
    isAi: result.isAi,
    scale: result.scale > 1 ? result.scale : null,
    parentVersionId: source.id,
    processingJobId: ctx.job.id,
    storageKey: outKey,
    previewKey,
    thumbKey,
    detailKey,
    filename,
    mimeType: result.mimeType,
    size: result.size,
    width: result.width,
    height: result.height,
    checksum: outHash,
    settings: { ...settings, steps: result.steps, warnings: result.warnings, analysis: result.analysis } as unknown as Prisma.InputJsonValue,
    fidelity: result.fidelity as unknown as Prisma.InputJsonValue,
  });
  await db.processingJob.update({ where: { id: ctx.job.id }, data: { outputVersionId: version.id, outputStorageKey: outKey } });
  ctx.log(`created version ${version.versionNumber} ${version.label} ${filename} (${result.width}×${result.height})`);
}
