import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { IntegrityError, ProcessingError } from "@/lib/errors";
import { stem } from "@/lib/file-types";
import { newId } from "@/lib/ids";
import { qualityLabel } from "@/lib/labels";
import { videoJobSettingsSchema } from "@/lib/processing/settings";
import { keys } from "@/lib/storage/keys";
import { storage } from "@/lib/storage/s3";
import { ReplicateVideoProvider } from "@/services/ai/replicate-video";
import { makeVideoPreviews, planVideo, probeVideo, RESOLUTION_HEIGHT, renderVideo } from "@/services/video/ffmpeg";
import { registerObject } from "@/server/storage-registry";
import { createVersion } from "@/server/versions";
import { downloadWithHash, hashLocalFile, verifyMasterIntegrity, type JobContext } from "../context";

export function videoCapabilities() {
  const ai = env().AI_VIDEO_PROVIDER === "replicate" && Boolean(env().AI_VIDEO_API_KEY ?? env().AI_IMAGE_API_KEY);
  return {
    aiUpscale: ai,
    deblur: false, // no motion-deblur model is configured for video; the UI disables it
    provider: ai ? "replicate" : "ffmpeg",
  };
}

/** VIDEO_ENHANCE: always asynchronous in a worker; creates a NEW version. */
export async function processVideo(ctx: JobContext): Promise<void> {
  const settings = videoJobSettingsSchema.parse(ctx.job.settings);
  const media = await db.mediaFile.findUniqueOrThrow({ where: { id: ctx.job.mediaId! } });
  if (media.mediaType !== "VIDEO") throw new ProcessingError("Not a video", undefined, false);
  const source = await db.mediaVersion.findFirst({ where: { id: settings.sourceVersionId, mediaId: media.id } });
  if (!source) throw new ProcessingError("Source version not found", settings.sourceVersionId, false);
  const caps = videoCapabilities();
  if (settings.deblur && !caps.deblur) {
    throw new ProcessingError("Video motion deblur is not supported by the configured video provider.", undefined, false);
  }
  if (settings.aiUpscale && !caps.aiUpscale) {
    throw new ProcessingError("AI video upscale requires AI_VIDEO_PROVIDER=replicate and an API key. Use the output resolution (Lanczos) instead.", undefined, false);
  }

  await ctx.progress(0.01, "Fetching source");
  const ext = source.filename.split(".").pop()?.toLowerCase() ?? media.extension;
  const src = join(ctx.workDir, `source.${ext}`);
  const hash = await downloadWithHash(source.storageKey, src);
  const expected = source.checksum ?? (source.isMasterRef ? media.checksum : null);
  if (expected && hash !== expected) throw new IntegrityError("Source file checksum changed — processing stopped.", `${expected} vs ${hash}`);

  const probe = await probeVideo(src);
  let input = src;
  let isAi = false;
  const engines = ["ffmpeg"];
  if (settings.aiUpscale) {
    await ctx.progress(0.05, "AI upscale");
    const targetHeight = settings.output.resolution === "source" ? null : RESOLUTION_HEIGHT[settings.output.resolution];
    const sourceUrl = await storage().presignGet(source.storageKey, { expiresIn: 6 * 3600 });
    const res = await new ReplicateVideoProvider().enhance(
      { path: src, sourceUrl, width: probe.displayWidth, height: probe.displayHeight, duration: probe.duration ?? 0, workDir: ctx.workDir, jobId: ctx.job.id, log: ctx.log, onProgress: (f) => void ctx.progress(0.05 + f * 0.45) },
      { scale: 4, targetHeight, facePreservation: true },
    );
    input = res.path;
    isAi = true;
    engines.unshift(res.engine);
  }
  const inProbe = input === src ? probe : await probeVideo(input);
  const plan = await planVideo(settings, inProbe, ctx.workDir, { aiUpscaled: settings.aiUpscale });
  // if AI produced a different height than requested, scale to the exact target
  if (settings.aiUpscale && settings.output.resolution !== "source") {
    const h = RESOLUTION_HEIGHT[settings.output.resolution];
    if (inProbe.displayHeight !== h) plan.filters.splice(plan.filters.length - 1, 0, `scale=-2:${h}:flags=lanczos`);
  }
  ctx.log(`ffmpeg filters: ${plan.filters.join(",")}`);
  const out = join(ctx.workDir, `output.${plan.extension}`);
  const base = settings.aiUpscale ? 0.5 : 0.05;
  await renderVideo(input, out, plan, inProbe, ctx.workDir, (f) => void ctx.progress(base + f * (0.85 - base), "Encoding"));
  const outProbe = await probeVideo(out);

  await ctx.progress(0.87, "Verifying master integrity");
  await verifyMasterIntegrity(media.id, ctx.log);

  await ctx.progress(0.9, "Saving new version");
  const versionId = newId();
  const s = storage();
  const res = settings.output.resolution;
  const filename = `${stem(media.filename)}_${res === "4k" ? "4k" : res === "1080p" ? "1080p" : "enhanced"}${settings.color?.preset ? `_${settings.color.preset.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""}.${plan.extension}`;
  const key = keys.version(media.projectId, media.id, versionId);
  const size = (await stat(out)).size;
  const checksum = await hashLocalFile(out);
  await s.uploadFile(key, out, plan.mimeType, filename);
  await registerObject({ key, category: "DERIVATIVE", size, projectId: media.projectId, mediaId: media.id, versionId });
  const pdir = join(ctx.workDir, "vp");
  await mkdir(pdir, { recursive: true });
  const pv = await makeVideoPreviews(out, pdir, outProbe);
  const up = async (local: string, variant: "proxy.mp4" | "poster.jpg" | "thumb.jpg", ct: string) => {
    const k = keys.versionPreview(media.projectId, versionId, variant);
    await s.uploadFile(k, local, ct);
    await registerObject({ key: k, category: "PREVIEW", size: (await stat(local)).size, projectId: media.projectId, mediaId: media.id, versionId });
    return k;
  };
  const previewKey = await up(pv.proxy, "proxy.mp4", "video/mp4");
  const detailKey = await up(pv.poster, "poster.jpg", "image/jpeg");
  const thumbKey = await up(pv.thumb, "thumb.jpg", "image/jpeg");

  const version = await createVersion({
    id: versionId,
    mediaId: media.id,
    projectId: media.projectId,
    versionType: "VIDEO_ENHANCED",
    label: qualityLabel({ versionType: "VIDEO_ENHANCED", mediaType: "VIDEO", isAi, videoResolution: res }),
    engine: engines.join(" + "),
    isAi,
    parentVersionId: source.id,
    processingJobId: ctx.job.id,
    storageKey: key,
    previewKey,
    thumbKey,
    detailKey,
    filename,
    mimeType: plan.mimeType,
    size,
    width: outProbe.displayWidth,
    height: outProbe.displayHeight,
    duration: outProbe.duration,
    bitrate: outProbe.bitrate,
    fps: outProbe.fps,
    checksum,
    settings: { ...settings, filters: plan.filters } as unknown as Prisma.InputJsonValue,
  });
  await db.processingJob.update({ where: { id: ctx.job.id }, data: { outputVersionId: version.id, outputStorageKey: key } });
}
