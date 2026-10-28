/**
 * Converting a raw drone clip (HEVC 10-bit, vertical, 60 fps — like DJI Air 3S
 * footage) into the phone-friendly version, using the real ffmpeg binary.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { afterAll, describe, expect, it } from "vitest";
import { needsOptimising, posterFor } from "@/lib/video";
import { transcodeForWeb } from "@/lib/video-transcode";

const dir = mkdtempSync(join(tmpdir(), "oxv-test-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function probe(file: string): string {
  try {
    execFileSync(ffmpegPath!, ["-hide_banner", "-i", file], { stdio: "pipe" });
    return "";
  } catch (e) {
    return String((e as { stderr?: Buffer }).stderr ?? "");
  }
}

describe("video optimising", () => {
  it("converts a vertical HEVC 10-bit 60fps clip into H.264 1080p, fast-start, with a cover frame", async () => {
    const input = join(dir, "dji.mp4");
    execFileSync(ffmpegPath!, [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "testsrc2=size=1512x2688:rate=60", "-t", "2",
      "-c:v", "libx265", "-pix_fmt", "yuv420p10le", "-tag:v", "hvc1", "-x265-params", "log-level=error",
      input,
    ]);
    expect(probe(input)).toMatch(/hevc.*yuv420p10le/);

    const out = await transcodeForWeb(input, dir);
    const info = probe(out.video);
    expect(info).toMatch(/Video: h264 \(High\)/);
    expect(info).toMatch(/yuv420p\(/);
    expect(info).toMatch(/1080x1920/);
    expect(info).toMatch(/30 fps/);
    expect(out.poster).not.toBeNull();
    expect(statSync(out.poster!).size).toBeGreaterThan(1000);
    expect(statSync(out.video).size).toBeLessThan(statSync(input).size * 2);
    expect(out.seconds).toBeCloseTo(2, 0);
  }, 120_000);

  it("rejects files that aren't videos", async () => {
    const bad = join(dir, "not-video.mp4");
    execFileSync("bash", ["-c", `echo hello > ${bad}`]);
    await expect(transcodeForWeb(bad, dir)).rejects.toThrow();
  });

  it("knows which videos are optimised and where their cover is", () => {
    const web = "https://abc.public.blob.vercel-storage.com/videos/web/1a2b3c4d5e6f7a8b9c0d.mp4";
    const raw = "https://abc.public.blob.vercel-storage.com/videos/1000010432-ELYu5Wgut9M72lCB3UfkQl1HnraVYK.mp4";
    expect(posterFor(web)).toBe(web.replace(".mp4", ".jpg"));
    expect(posterFor(raw)).toBeNull();
    expect(needsOptimising(raw)).toBe(true);
    expect(needsOptimising(web)).toBe(false);
    expect(needsOptimising("https://youtube.com/watch?v=abc")).toBe(false);
  });
});
