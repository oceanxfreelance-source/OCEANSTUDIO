import type { MediaFile, MediaVersion } from "@prisma/client";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage/s3";

export type VersionCategory = "ORIGINAL" | "ORIGINAL_RAW" | "ENHANCED" | "COLOR_GRADED" | "ENHANCED_COLOR" | "RAW_DEVELOPED";

export function versionCategory(v: Pick<MediaVersion, "versionType" | "settings">, mediaType: MediaFile["mediaType"]): VersionCategory {
  const hasColor = Boolean((v.settings as { color?: unknown } | null)?.color);
  switch (v.versionType) {
    case "ORIGINAL":
      return mediaType === "RAW" ? "ORIGINAL_RAW" : "ORIGINAL";
    case "COLOR_GRADED":
      return "COLOR_GRADED";
    case "RAW_DEVELOPED":
      return hasColor ? "COLOR_GRADED" : "RAW_DEVELOPED";
    default:
      return hasColor ? "ENHANCED_COLOR" : "ENHANCED";
  }
}

/** Plain, client-safe version view with short-lived signed preview URLs. */
export async function versionView(v: MediaVersion, mediaType: MediaFile["mediaType"]) {
  const s = storage();
  const ttl = env().PREVIEW_URL_TTL_SECONDS;
  return {
    id: v.id,
    mediaId: v.mediaId,
    versionNumber: v.versionNumber,
    versionType: v.versionType,
    category: versionCategory(v, mediaType),
    label: v.label,
    engine: v.engine,
    isAi: v.isAi,
    scale: v.scale,
    filename: v.filename,
    mimeType: v.mimeType,
    size: Number(v.size),
    width: v.width,
    height: v.height,
    duration: v.duration,
    fps: v.fps,
    bitrate: v.bitrate ? Number(v.bitrate) : null,
    checksum: v.checksum,
    isMasterRef: v.isMasterRef,
    published: v.published,
    createdAt: v.createdAt.toISOString(),
    parentVersionId: v.parentVersionId,
    settings: v.settings,
    fidelity: v.fidelity,
    thumbUrl: v.thumbKey ? await s.presignGet(v.thumbKey, { expiresIn: ttl }) : null,
    previewUrl: v.previewKey ? await s.presignGet(v.previewKey, { expiresIn: ttl }) : null,
    detailUrl: v.detailKey ? await s.presignGet(v.detailKey, { expiresIn: ttl }) : null,
  };
}
export type VersionView = Awaited<ReturnType<typeof versionView>>;

export async function mediaView(m: MediaFile & { versions: MediaVersion[]; _count?: { favorites: number } }) {
  const s = storage();
  const ttl = env().PREVIEW_URL_TTL_SECONDS;
  return {
    id: m.id,
    projectId: m.projectId,
    filename: m.filename,
    extension: m.extension,
    mediaType: m.mediaType,
    mimeType: m.mimeType,
    size: Number(m.size),
    width: m.width,
    height: m.height,
    duration: m.duration,
    fps: m.fps,
    codec: m.codec,
    bitrate: m.bitrate ? Number(m.bitrate) : null,
    audioCodec: m.audioCodec,
    container: m.container,
    checksum: m.checksum,
    status: m.status,
    integrityStatus: m.integrityStatus,
    integrityCheckedAt: m.integrityCheckedAt?.toISOString() ?? null,
    errorMessage: m.errorMessage,
    capturedAt: m.capturedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    favorites: m._count?.favorites ?? 0,
    thumbUrl: m.thumbKey ? await s.presignGet(m.thumbKey, { expiresIn: ttl }) : null,
    versions: await Promise.all(m.versions.map((v) => versionView(v, m.mediaType))),
  };
}
export type MediaView = Awaited<ReturnType<typeof mediaView>>;
