import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ProcessingError } from "@/lib/errors";
import { NEUTRAL_ADJUSTMENTS, type ColorGradeSettings, type VideoJobSettings } from "@/lib/processing/settings";
import { compileEngine } from "../color/engine";
import { resolveGrade } from "../color/presets";
import { run, runOrThrow } from "../exec";

export interface VideoProbe {
  width: number;
  height: number;
  /** display dimensions after rotation metadata */
  displayWidth: number;
  displayHeight: number;
  fps: number | null;
  duration: number | null;
  codec: string | null;
  bitrate: number | null;
  audioCodec: string | null;
  container: string | null;
  pixFmt: string | null;
  rotation: number;
  color: { primaries: string | null; transfer: string | null; space: string | null; range: string | null };
  hasAudio: boolean;
  creationTime: string | null;
  raw: unknown;
}

function parseRate(r: string | undefined): number | null {
  if (!r) return null;
  const [n, d] = r.split("/").map(Number);
  if (!n || !d) return null;
  return Math.round((n / d) * 1000) / 1000;
}

export async function probeVideo(path: string): Promise<VideoProbe> {
  const res = await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", "--", path], {
    timeoutMs: 120_000,
  });
  if (res.code !== 0) throw new ProcessingError("Video inspection failed: the file could not be read", res.stderr);
  const j = JSON.parse(res.stdout.toString("utf8")) as {
    streams?: Record<string, unknown>[];
    format?: Record<string, unknown>;
  };
  const v = j.streams?.find((s) => s.codec_type === "video");
  if (!v) throw new ProcessingError("Video inspection failed: no video stream found");
  const a = j.streams?.find((s) => s.codec_type === "audio");
  const sideData = (v.side_data_list as { rotation?: number }[] | undefined) ?? [];
  const tags = (v.tags as Record<string, string> | undefined) ?? {};
  const rotation = Math.abs(Number(sideData.find((s) => s.rotation !== undefined)?.rotation ?? tags.rotate ?? 0)) % 360;
  const width = Number(v.width);
  const height = Number(v.height);
  const swap = rotation === 90 || rotation === 270;
  const fmt = j.format ?? {};
  const fmtTags = (fmt.tags as Record<string, string> | undefined) ?? {};
  return {
    width,
    height,
    displayWidth: swap ? height : width,
    displayHeight: swap ? width : height,
    fps: parseRate(v.avg_frame_rate as string) ?? parseRate(v.r_frame_rate as string),
    duration: Number(fmt.duration ?? v.duration) || null,
    codec: (v.codec_name as string) ?? null,
    bitrate: Number(v.bit_rate ?? fmt.bit_rate) || null,
    audioCodec: (a?.codec_name as string) ?? null,
    container: (fmt.format_name as string) ?? null,
    pixFmt: (v.pix_fmt as string) ?? null,
    rotation,
    color: {
      primaries: (v.color_primaries as string) ?? null,
      transfer: (v.color_transfer as string) ?? null,
      space: (v.color_space as string) ?? null,
      range: (v.color_range as string) ?? null,
    },
    hasAudio: Boolean(a),
    creationTime: fmtTags.creation_time ?? tags.creation_time ?? null,
    raw: j,
  };
}

/** Run ffmpeg with machine-readable progress (fraction of duration). */
export async function ffmpeg(args: string[], duration: number | null, onProgress?: (f: number) => void, human = "Video processing failed") {
  return runOrThrow("ffmpeg", ["-hide_banner", "-nostdin", "-y", "-progress", "pipe:1", "-nostats", ...args], human, {
    timeoutMs: 12 * 3600_000,
    onStdoutLine: (line) => {
      const m = /^out_time_(?:us|ms)=(\d+)/.exec(line);
      if (m && duration && onProgress) onProgress(Math.min(0.999, Number(m[1]) / 1e6 / duration));
    },
  });
}

/** Browser proxy (H.264 720p, faststart) + poster frame. Previews only — never delivered as downloads. */
export async function makeVideoPreviews(input: string, outDir: string, probe: VideoProbe) {
  const proxy = join(outDir, "proxy.mp4");
  const poster = join(outDir, "poster.jpg");
  const thumb = join(outDir, "thumb.jpg");
  const scale = "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))':flags=lanczos,format=yuv420p";
  await ffmpeg(
    [
      "-i", input,
      "-map", "0:v:0", "-map", "0:a:0?",
      "-vf", scale,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-profile:v", "high",
      "-c:a", "aac", "-b:a", "128k", "-ac", "2",
      "-movflags", "+faststart",
      proxy,
    ],
    probe.duration,
    undefined,
    "Video preview generation failed",
  );
  const at = Math.max(0, Math.min((probe.duration ?? 0) * 0.1, 10));
  await ffmpeg(["-ss", at.toFixed(2), "-i", input, "-frames:v", "1", "-vf", "scale='min(2048,iw)':-2:flags=lanczos", "-q:v", "3", poster], null, undefined, "Poster frame failed");
  await ffmpeg(["-i", poster, "-vf", "scale='min(480,iw)':-2:flags=lanczos", "-q:v", "5", thumb], null, undefined, "Thumbnail failed");
  return { proxy, poster, thumb };
}

/**
 * Bake the photo color engine into a 33³ 3D LUT so video grading uses exactly
 * the same presets and math as stills.
 */
export async function writeGradeLut(grade: ColorGradeSettings, extra: Partial<typeof NEUTRAL_ADJUSTMENTS>, path: string): Promise<void> {
  const resolved = resolveGrade(grade);
  const adjustments = { ...NEUTRAL_ADJUSTMENTS, ...resolved.adjustments };
  for (const [k, v] of Object.entries(extra) as [keyof typeof adjustments, number][]) adjustments[k] += v;
  const engine = compileEngine({ adjustments, extras: resolved.extras });
  const N = 33;
  const data = new Float32Array(N * N * N * 3);
  let i = 0;
  for (let b = 0; b < N; b++)
    for (let g = 0; g < N; g++)
      for (let r = 0; r < N; r++) {
        data[i++] = r / (N - 1);
        data[i++] = g / (N - 1);
        data[i++] = b / (N - 1);
      }
  engine.apply(data);
  const lines = ["TITLE \"OCEANX grade\"", `LUT_3D_SIZE ${N}`, "DOMAIN_MIN 0 0 0", "DOMAIN_MAX 1 1 1"];
  for (let j = 0; j < data.length; j += 3) lines.push(`${data[j]!.toFixed(6)} ${data[j + 1]!.toFixed(6)} ${data[j + 2]!.toFixed(6)}`);
  await writeFile(path, lines.join("\n") + "\n");
}

export const RESOLUTION_HEIGHT = { "1080p": 1080, "4k": 2160 } as const;

export interface VideoPlan {
  filters: string[];
  needsStabilizePass: boolean;
  lutPath: string | null;
  targetHeight: number | null;
  encoder: string[];
  extension: "mp4" | "mov";
  mimeType: string;
}

/**
 * Build the FFmpeg filter graph for classical video enhancement. Heavy AI
 * upscaling is delegated to a VideoEnhancementProvider when configured.
 */
export async function planVideo(settings: VideoJobSettings, probe: VideoProbe, workDir: string, opts: { aiUpscaled: boolean }): Promise<VideoPlan> {
  const k = { natural: 0.5, balanced: 0.75, maximum: 1 }[settings.quality];
  const filters: string[] = [];
  if (settings.stabilization) {
    filters.push(`vidstabtransform=input=${join(workDir, "transforms.trf")}:smoothing=${Math.round(10 + 20 * k)}:zoom=0:optzoom=1:interpol=bicubic`);
  }
  if (settings.denoise) {
    filters.push(settings.quality === "natural" ? `hqdn3d=${(2 * k).toFixed(2)}:${(1.5 * k).toFixed(2)}:${(3 * k).toFixed(2)}:${(3 * k).toFixed(2)}` : `nlmeans=s=${(1 + 3 * k).toFixed(1)}:p=7:r=15`);
  }
  if (settings.lowLight) {
    filters.push(`eq=gamma=${(1 + 0.25 * k).toFixed(3)}:brightness=${(0.02 * k).toFixed(3)}:saturation=${(1 + 0.08 * k).toFixed(3)}`);
  }
  let lutPath: string | null = null;
  if (settings.colorCorrection || settings.color) {
    lutPath = join(workDir, "grade.cube");
    const correction = settings.colorCorrection ? { contrast: 8, vibrance: 10, highlights: -10, shadows: 8 } : {};
    await writeGradeLut(settings.color ?? { preset: null, intensity: 100, adjustments: {} }, correction, lutPath);
    filters.push(`lut3d=file=${lutPath}:interp=tetrahedral`);
  }
  const targetHeight = settings.output.resolution === "source" ? null : RESOLUTION_HEIGHT[settings.output.resolution];
  if (targetHeight && !opts.aiUpscaled) {
    const portrait = probe.displayHeight > probe.displayWidth;
    filters.push(portrait ? `scale=${targetHeight}:-2:flags=lanczos` : `scale=-2:${targetHeight}:flags=lanczos`);
  }
  if (settings.sharpen) {
    const amt = 0.4 + 0.6 * k;
    filters.push(`unsharp=5:5:${amt.toFixed(2)}:5:5:0`);
  }
  const tenBit = settings.output.codec !== "h264";
  filters.push(tenBit ? (settings.output.codec === "prores" ? "format=yuv422p10le" : "format=yuv420p10le") : "format=yuv420p");

  const encoder =
    settings.output.codec === "prores"
      ? ["-c:v", "prores_ks", "-profile:v", "3", "-vendor", "apl0"]
      : settings.output.codec === "hevc"
        ? ["-c:v", "libx265", "-preset", "slow", "-crf", "16", "-tag:v", "hvc1"]
        : ["-c:v", "libx264", "-preset", "slow", "-crf", "14", "-profile:v", "high"];
  return {
    filters,
    needsStabilizePass: settings.stabilization,
    lutPath,
    targetHeight,
    encoder,
    extension: settings.output.codec === "prores" ? "mov" : "mp4",
    mimeType: settings.output.codec === "prores" ? "video/quicktime" : "video/mp4",
  };
}

const MP4_SAFE_AUDIO = new Set(["aac", "mp3", "alac", "ac3", "eac3", "opus", "flac"]);

/** Audio is stream-copied whenever the container allows it; otherwise encoded to high-bitrate AAC. */
export function audioArgs(probe: VideoProbe, ext: "mp4" | "mov"): string[] {
  if (!probe.hasAudio) return [];
  if (ext === "mov" || (probe.audioCodec && MP4_SAFE_AUDIO.has(probe.audioCodec))) return ["-c:a", "copy"];
  return ["-c:a", "aac", "-b:a", "320k"];
}

/** Execute the plan: optional vid.stab analysis pass, then one encode with audio copied untouched. */
export async function renderVideo(input: string, output: string, plan: VideoPlan, probe: VideoProbe, workDir: string, onProgress: (f: number) => void) {
  if (plan.needsStabilizePass) {
    await ffmpeg(
      ["-i", input, "-vf", `vidstabdetect=shakiness=6:accuracy=12:result=${join(workDir, "transforms.trf")}`, "-f", "null", "-"],
      probe.duration,
      (f) => onProgress(f * 0.3),
      "Stabilization analysis failed",
    );
  }
  const base = plan.needsStabilizePass ? 0.3 : 0;
  await ffmpeg(
    [
      "-i", input,
      "-map", "0:v:0", "-map", "0:a?",
      "-map_metadata", "0",
      "-vf", plan.filters.join(","),
      ...plan.encoder,
      // keep the source frame rate & color description, and the audio untouched
      "-fps_mode", "passthrough",
      ...(probe.color.primaries ? ["-color_primaries", probe.color.primaries] : []),
      ...(probe.color.transfer ? ["-color_trc", probe.color.transfer] : []),
      ...(probe.color.space ? ["-colorspace", probe.color.space] : []),
      ...audioArgs(probe, plan.extension),
      "-movflags", "+faststart+use_metadata_tags",
      output,
    ],
    probe.duration,
    (f) => onProgress(base + f * (1 - base)),
  );
}
