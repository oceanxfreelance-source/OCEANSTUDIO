import type { MediaType, VersionType } from "@prisma/client";

export interface LabelInput {
  versionType: VersionType;
  mediaType: MediaType;
  isAi: boolean;
  scale?: number | null;
  colorPreset?: string | null;
  videoResolution?: "source" | "1080p" | "4k" | null;
}

/**
 * Accurate quality labels. An AI or processed output is never labelled ORIGINAL,
 * and a non-AI (classical) result is never labelled AI.
 */
export function qualityLabel(v: LabelInput): string {
  const ai = v.isAi ? "AI " : "";
  switch (v.versionType) {
    case "ORIGINAL":
      return v.mediaType === "RAW" ? "ORIGINAL RAW" : "ORIGINAL";
    case "RAW_DEVELOPED":
      return "RAW DEVELOPED";
    case "AI_ENHANCED":
    case "ENHANCED":
    case "UPSCALED": {
      const scale = v.scale && v.scale > 1 ? ` ${v.scale}×` : "";
      const base = scale ? `${ai}ENHANCED${scale}` : `${ai}ENHANCED`;
      return v.colorPreset ? `${base} + ${v.colorPreset.toUpperCase()}` : base;
    }
    case "COLOR_GRADED":
      return v.colorPreset ? `COLOR GRADED · ${v.colorPreset.toUpperCase()}` : "COLOR GRADED";
    case "VIDEO_ENHANCED":
      if (v.videoResolution === "4k") return `${ai}4K ENHANCED`;
      if (v.videoResolution === "1080p") return `${ai}1080P ENHANCED`;
      return `${ai}ENHANCED`;
  }
}

export function formatBytes(bytes: number | bigint | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  let n = Number(bytes);
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n >= 100 || i === 0 ? n.toFixed(0) : n.toFixed(1)} ${units[i]}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds && seconds !== 0) return "—";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}
