import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { cartTotal, clipsPrice, type CartClip } from "@/lib/shop-rules";
import { makePreview } from "@/lib/clip-preview";

const prices = { clip: 20, session: 60, reel: 100 };
const clip = (id: string, date = "2026-10-27", slot = "MORNING", spot = "MC"): CartClip => ({ id, code: id, date, slot, spot, spotName: "Machines", poster: null });

describe("clip pricing", () => {
  it("charges the clip price for every clip picked — no cap, no packages", () => {
    expect(clipsPrice(prices, 1)).toBe(20);
    expect(clipsPrice(prices, 5)).toBe(100);
    const r = cartTotal(prices, [clip("a"), clip("b"), clip("c"), clip("d"), clip("e", "2026-10-27", "AFTERNOON")]);
    expect(r.sessions).toHaveLength(2);
    expect(r.sessions.map((s) => s.price)).toEqual([80, 20]);
    expect(r.total).toBe(100);
  });
});

describe("clip preview", () => {
  it("makes a small, short, silent 480p preview of a 4K vertical clip", async () => {
    const dir = await mkdtemp(join(tmpdir(), "oxp-"));
    try {
      const input = join(dir, "in.mp4");
      const gen = spawnSync(ffmpegPath!, ["-y", "-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=30:duration=14", "-f", "lavfi", "-i", "sine=duration=14", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", input]);
      expect(gen.status).toBe(0);
      const out = await makePreview(input, dir);
      expect(out.seconds).toBeCloseTo(14, 0);
      const probe = spawnSync(ffmpegPath!, ["-hide_banner", "-i", out.preview]).stderr.toString();
      expect(probe).toMatch(/480x854/);
      expect(probe).not.toMatch(/Audio:/);
      expect(probe).toMatch(/Duration: 00:00:0[78]/);
      expect((await stat(out.preview)).size).toBeLessThan(1_500_000);
      expect(out.poster).toBeTruthy();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
