import "server-only";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import ffmpegPath from "ffmpeg-static";

/**
 * Public preview of a clip: max 8 s, 480p, 24 fps, no sound, with a tiled
 * "OCEAN X · PREVIEW" watermark — about 0.5 MB, quick on island internet.
 * The original is never altered or exposed.
 */
export const PREVIEW_SECONDS = 8;
export const WATERMARK = resolve(process.cwd(), "assets/preview-watermark.png");

export class PreviewError extends Error {}

function run(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((done, fail) => {
    if (!ffmpegPath || !existsSync(ffmpegPath)) return fail(new PreviewError("Video converter is not available on the server."));
    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d: Buffer) => (stderr = (stderr + d.toString()).slice(-20000)));
    p.on("error", fail);
    p.on("close", (code) => done({ code: code ?? 1, stderr }));
  });
}

export function durationOf(stderr: string): number | null {
  const m = stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/** `input` is a local path or an https URL (ffmpeg then only fetches the part it needs). */
export async function makePreview(input: string, dir: string): Promise<{ preview: string; poster: string | null; seconds: number | null }> {
  const probe = await run(["-hide_banner", "-i", input]);
  if (!/Stream #\d+:\d+.*Video:/.test(probe.stderr)) throw new PreviewError("This file doesn't contain a video.");
  const seconds = durationOf(probe.stderr);
  const start = seconds && seconds > PREVIEW_SECONDS + 3 ? 1 : 0;

  const preview = join(dir, "preview.mp4");
  const encode = await run([
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", String(start), "-t", String(PREVIEW_SECONDS), "-i", input,
    "-i", WATERMARK,
    "-filter_complex",
    // Short side 480 px (vertical clips stay vertical), then the watermark centred on top.
    "[0:v]scale=w='if(gt(iw,ih),-2,480)':h='if(gt(iw,ih),480,-2)',fps=24,format=yuv420p[v];[v][1:v]overlay=(W-w)/2:(H-h)/2[o]",
    "-map", "[o]", "-an",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "31", "-maxrate", "700k", "-bufsize", "1400k",
    "-profile:v", "main", "-movflags", "+faststart",
    preview,
  ]);
  if (encode.code !== 0) throw new PreviewError("The preview couldn't be made from this file.");

  const poster = join(dir, "poster.jpg");
  const shot = await run(["-hide_banner", "-loglevel", "error", "-y", "-ss", "1", "-i", preview, "-frames:v", "1", "-q:v", "5", poster]);
  return { preview, poster: shot.code === 0 ? poster : null, seconds };
}
