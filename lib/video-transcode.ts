import "server-only";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { put } from "@vercel/blob";
import ffmpegPath from "ffmpeg-static";

/**
 * Turns a raw camera/drone video (e.g. DJI HEVC 10-bit, 50 Mbit/s) into a
 * version every phone and browser can play: H.264, max 1920px, 30 fps,
 * ~6 Mbit/s, "fast start" (plays while downloading) — plus a JPEG cover frame.
 */

export const MAX_OPTIMISE_SECONDS = 150;

export class VideoError extends Error {}

function run(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath || !existsSync(ffmpegPath)) return reject(new VideoError("Video converter is not available on the server."));
    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-20000);
    });
    p.on("error", reject);
    p.on("close", (code) => resolve({ code: code ?? 1, stderr }));
  });
}

function durationOf(stderr: string): number | null {
  const m = stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/**
 * Convert `input` (any camera video) into web.mp4 + poster.jpg inside `dir`.
 * Exported separately so it can be tested without cloud storage.
 */
export async function transcodeForWeb(input: string, dir: string): Promise<{ video: string; poster: string | null; seconds: number | null }> {
  const output = join(dir, "web.mp4");
  const poster = join(dir, "poster.jpg");

  // Probe (ffmpeg prints the duration even though there is no output).
  const probe = await run(["-hide_banner", "-i", input]);
  const seconds = durationOf(probe.stderr);
  if (!/Stream #\d+:\d+.*Video:/.test(probe.stderr)) throw new VideoError("This file doesn't contain a video.");
  if (seconds !== null && seconds > MAX_OPTIMISE_SECONDS) {
    throw new VideoError(`This clip is ${Math.round(seconds)} s long. Please upload clips up to 2½ minutes — short edits look best on the site.`);
  }

  const encode = await run([
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", input,
    "-map", "0:v:0", "-map", "0:a:0?",
    "-vf", "scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))',fps=30,format=yuv420p",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-maxrate", "6M", "-bufsize", "12M",
    "-profile:v", "high", "-level", "4.1",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart",
    output,
  ]);
  if (encode.code !== 0) throw new VideoError("The video couldn't be converted. Try exporting it again from your camera app.");

  const at = seconds ? Math.min(1, seconds / 3).toFixed(2) : "0";
  const shot = await run(["-hide_banner", "-loglevel", "error", "-y", "-ss", at, "-i", output, "-frames:v", "1", "-q:v", "3", poster]);
  return { video: output, poster: shot.code === 0 ? poster : null, seconds };
}

export async function optimiseVideo(sourceUrl: string): Promise<{ url: string; posterUrl: string }> {
  const dir = await mkdtemp(join(tmpdir(), "oxv-"));
  const input = join(dir, "in");
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok || !res.body) throw new VideoError(`Could not download the video (${res.status}).`);
    await pipeline(Readable.fromWeb(res.body as unknown as WebReadableStream), createWriteStream(input));

    const out = await transcodeForWeb(input, dir);
    const id = randomUUID().replace(/-/g, "").slice(0, 20);
    const common = { access: "public" as const, addRandomSuffix: false, cacheControlMaxAge: 60 * 60 * 24 * 365 };
    const [video, image] = await Promise.all([
      put(`videos/web/${id}.mp4`, await readFile(out.video), { ...common, contentType: "video/mp4" }),
      out.poster ? put(`videos/web/${id}.jpg`, await readFile(out.poster), { ...common, contentType: "image/jpeg" }).catch(() => null) : null,
    ]);
    return { url: video.url, posterUrl: image?.url ?? "" };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
