import { run } from "../exec";
import type { FaceRegion } from "../raw/types";

export type ExifRecord = Record<string, unknown>;

/** Read all metadata ExifTool understands (numeric values, structured XMP). */
export async function readExif(path: string): Promise<ExifRecord> {
  const res = await run("exiftool", ["-json", "-n", "-struct", "-api", "LargeFileSupport=1", "--", path], { timeoutMs: 120_000 });
  if (res.code !== 0) return {};
  try {
    const parsed = JSON.parse(res.stdout.toString("utf8")) as ExifRecord[];
    const rec = parsed[0] ?? {};
    // drop filesystem-specific and bulky binary placeholders
    for (const k of Object.keys(rec)) {
      if (/^(SourceFile|Directory|File(Access|Modify|InodeChange)Date|FilePermissions|ExifToolVersion)$/.test(k)) delete rec[k];
      const v = rec[k];
      if (typeof v === "string" && v.startsWith("(Binary data")) delete rec[k];
    }
    return rec;
  } catch {
    return {};
  }
}

const str = (v: unknown): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};
const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parts = v.trim().split(/\s+/).map(Number).filter((n) => Number.isFinite(n) && n > 0);
    return parts.length ? parts[parts.length - 1]! : null;
  }
  return null;
};

export function parseExifDate(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?/.exec(s);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] ?? "Z"}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatShutter(v: unknown): string | null {
  const n = num(v);
  if (!n) return null;
  return n >= 1 ? `${n}s` : `1/${Math.round(1 / n)}s`;
}

export interface CameraSummary {
  cameraMake: string | null;
  cameraModel: string | null;
  lens: string | null;
  iso: number | null;
  shutter: string | null;
  aperture: number | null;
  focalLength: number | null;
  capturedAt: Date | null;
  orientation: number;
}

export function summarize(e: ExifRecord): CameraSummary {
  return {
    cameraMake: str(e.Make),
    cameraModel: str(e.Model),
    lens: str(e.LensID) ?? str(e.LensModel) ?? str(e.Lens) ?? str(e.LensType),
    iso: num(e.ISO) !== null ? Math.round(num(e.ISO)!) : null,
    shutter: formatShutter(e.ExposureTime ?? e.ShutterSpeed),
    aperture: num(e.FNumber ?? e.Aperture),
    focalLength: num(e.FocalLength),
    capturedAt: parseExifDate(e.DateTimeOriginal ?? e.CreateDate ?? e.MediaCreateDate),
    orientation: Number(e.Orientation ?? 1) || 1,
  };
}

/**
 * Face regions recorded by the camera (Nikon/Canon/Sony face-detect makernotes)
 * or by editing software (MWG XMP RegionInfo). Used for face zoom and for the
 * per-face fidelity guard.
 */
export function extractFaceRegions(e: ExifRecord): FaceRegion[] {
  const out: FaceRegion[] = [];
  const regionInfo = e.RegionInfo as
    | { RegionList?: { Type?: string; Area?: { X?: number; Y?: number; W?: number; H?: number } }[] }
    | undefined;
  for (const r of regionInfo?.RegionList ?? []) {
    if (r.Type && r.Type !== "Face") continue;
    const a = r.Area;
    if (!a || a.X === undefined || a.Y === undefined || !a.W || !a.H) continue;
    out.push({ x: a.X - a.W / 2, y: a.Y - a.H / 2, w: a.W, h: a.H, source: "xmp-mwg" });
  }
  const frame = str(e.FaceDetectFrameSize)?.split(/\s+/).map(Number);
  const count = Number(e.FacesDetected ?? 0);
  if (frame && frame.length === 2 && frame[0]! > 0 && frame[1]! > 0) {
    for (let i = 1; i <= Math.min(count || 12, 12); i++) {
      const pos = str(e[`Face${i}Position`])?.split(/\s+/).map(Number);
      if (!pos || pos.length < 4 || pos.some((n) => !Number.isFinite(n))) continue;
      const [x, y, w, h] = pos as [number, number, number, number];
      if (w <= 0 || h <= 0) continue;
      out.push({ x: x / frame[0]!, y: y / frame[1]!, w: w / frame[0]!, h: h / frame[1]!, source: "camera" });
    }
  }
  return out.filter((f) => f.w > 0 && f.h > 0 && f.x >= -0.05 && f.y >= -0.05 && f.x + f.w <= 1.05 && f.y + f.h <= 1.05);
}

/** Copy camera, lens and capture metadata onto a derivative, normalising orientation. */
export async function copyMetadata(source: string, target: string): Promise<void> {
  await run(
    "exiftool",
    [
      "-overwrite_original",
      "-api",
      "LargeFileSupport=1",
      "-TagsFromFile",
      source,
      "-EXIF:all",
      "-XMP:all",
      "-IPTC:all",
      "--Orientation",
      "--ImageWidth",
      "--ImageHeight",
      "--ExifImageWidth",
      "--ExifImageHeight",
      "--ThumbnailImage",
      "--PreviewImage",
      "--JpgFromRaw",
      "--StripOffsets",
      "--StripByteCounts",
      "-Software=OCEANX STUDIO",
      "--",
      target,
    ],
    { timeoutMs: 300_000 },
  );
  // Failure to copy metadata is non-fatal: pixels are what matter.
}
