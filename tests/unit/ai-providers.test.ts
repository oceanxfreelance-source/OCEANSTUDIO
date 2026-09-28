import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ClassicalImageProvider } from "@/services/ai/classical";
import { checkFidelity } from "@/services/ai/fidelity";
import { ReplicateImageProvider } from "@/services/ai/replicate";

let dir: string;
const face = (eyeY: number, jawW: number) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">
    <rect width="600" height="400" fill="#6a8fb0"/>
    <ellipse cx="300" cy="200" rx="${jawW}" ry="150" fill="#e0b090"/>
    <circle cx="250" cy="${eyeY}" r="18" fill="#222"/><circle cx="350" cy="${eyeY}" r="18" fill="#222"/>
    <rect x="285" y="190" width="30" height="50" fill="#c08060"/>
    <rect x="250" y="270" width="100" height="16" fill="#803030"/>
  </svg>`);

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "oceanx-unit-"));
  await sharp(face(160, 110)).png().toFile(join(dir, "ref.png"));
  await sharp(face(160, 110)).sharpen({ sigma: 1, m2: 2 }).png().toFile(join(dir, "sharpened.png"));
  await sharp(face(125, 150)).png().toFile(join(dir, "redesigned.png"));
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe("face preservation fidelity guard", () => {
  const faces = [{ x: 190 / 600, y: 50 / 400, w: 220 / 600, h: 300 / 400, source: "test" }];
  it("accepts restoration that keeps structure", async () => {
    const r = await checkFidelity(join(dir, "ref.png"), join(dir, "sharpened.png"), { quality: "natural", faceRegions: faces });
    expect(r.passed).toBe(true);
    expect(r.faces[0]!.passed).toBe(true);
  });
  it("rejects a result that changes face shape / eye position", async () => {
    const r = await checkFidelity(join(dir, "ref.png"), join(dir, "redesigned.png"), { quality: "maximum", faceRegions: faces });
    expect(r.passed).toBe(false);
    expect(r.faces[0]!.passed).toBe(false);
  });
  it("compares across resolutions (upscaled candidate)", async () => {
    await sharp(join(dir, "ref.png")).resize(4800, 3200, { kernel: "lanczos3" }).png().toFile(join(dir, "up8.png"));
    const r = await checkFidelity(join(dir, "ref.png"), join(dir, "up8.png"), { quality: "natural", faceRegions: faces });
    expect(r.passed).toBe(true);
  });
});

describe("classical provider", () => {
  it("upscales exactly and declares itself non-AI", async () => {
    const p = new ClassicalImageProvider();
    const res = await p.enhance(
      { path: join(dir, "ref.png"), width: 600, height: 400, workDir: dir, jobId: "unitjob1", log: () => undefined },
      { operation: "upscale", scale: 4, quality: "natural", facePreservation: true, strength: 0.35 },
    );
    expect([res.width, res.height]).toEqual([2400, 1600]);
    expect(res.isAi).toBe(false);
    expect(p.capabilities().deblur).toBe(false);
  });
  it("refuses motion deblur instead of faking it", async () => {
    await expect(
      new ClassicalImageProvider().enhance(
        { path: join(dir, "ref.png"), width: 600, height: 400, workDir: dir, jobId: "unitjob1", log: () => undefined },
        { operation: "deblur", quality: "natural", facePreservation: true, strength: 0.35 },
      ),
    ).rejects.toThrow(/AI image provider/);
  });
});

describe("Replicate provider (HTTP mocked)", () => {
  it("tiles, calls the model with face_enhance disabled, and stitches seamlessly", async () => {
    const calls: { url: string; body?: unknown }[] = [];
    const uploads = new Map<string, Buffer>();
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/files") && init?.method === "POST") {
        const form = init.body as FormData;
        const blob = form.get("content") as Blob;
        const id = `f${uploads.size}`;
        uploads.set(id, Buffer.from(await blob.arrayBuffer()));
        return new Response(JSON.stringify({ id, urls: { get: `https://files.test/${id}` } }), { status: 201 });
      }
      if (u.includes("/files/") && init?.method === "DELETE") return new Response(null, { status: 204 });
      if (u.includes("/predictions") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        calls.push({ url: u, body });
        const id = body.input.image.split("/").pop();
        return new Response(JSON.stringify({ id: `p-${id}`, status: "succeeded", output: `https://out.test/${id}?scale=${body.input.scale}` }), { status: 201 });
      }
      if (u.startsWith("https://out.test/")) {
        const [id, q] = u.slice("https://out.test/".length).split("?scale=");
        const src = uploads.get(id!)!;
        const m = await sharp(src).metadata();
        const scale = Number(q);
        const out = await sharp(src).resize(m.width! * scale, m.height! * scale, { kernel: "lanczos3" }).png().toBuffer();
        return new Response(new Uint8Array(out), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    process.env.REPLICATE_MAX_TILE_PIXELS = "40000"; // force many tiles on a 600×400 image
    const { resetEnvCache } = await import("@/lib/env");
    resetEnvCache();
    const p = new ReplicateImageProvider({ apiKey: "test", fetchImpl, pollIntervalMs: 1 });
    const res = await p.enhance(
      { path: join(dir, "ref.png"), width: 600, height: 400, workDir: dir, jobId: "unitjob2", log: () => undefined },
      { operation: "upscale", scale: 2, quality: "natural", facePreservation: true, strength: 0.35 },
    );
    expect(res.isAi).toBe(true);
    expect([res.width, res.height]).toEqual([1200, 800]);
    expect(calls.length).toBeGreaterThan(4);
    for (const c of calls) expect((c.body as { input: { face_enhance: boolean } }).input.face_enhance).toBe(false);
    const reference = join(dir, "ref2x.png");
    await sharp(join(dir, "ref.png")).resize(1200, 800, { kernel: "lanczos3" }).png().toFile(reference);
    const report = await checkFidelity(reference, res.path, { quality: "natural" });
    expect(report.minBlockSsim).toBeGreaterThan(0.97); // no visible seams
    delete process.env.REPLICATE_MAX_TILE_PIXELS;
    resetEnvCache();
  });
});
