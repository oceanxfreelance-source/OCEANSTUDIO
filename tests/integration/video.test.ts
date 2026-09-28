/** §90 VIDEO acceptance: MP4 → inspect → enhance to 4K (worker) → publish → exact download. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { probeVideo } from "@/services/video/ffmpeg";
import { call, createAdmin, drainJobs, handlers, sha256, tokenFromLink, uploadFile } from "./helpers";

describe("video pipeline", () => {
  let h: Awaited<ReturnType<typeof handlers>>;
  let admin: { cookie: string };
  let projectId: string, mediaId: string, mp4: Buffer;

  beforeAll(async () => {
    h = await handlers();
    admin = await createAdmin();
    const dir = mkdtempSync(join(tmpdir(), "oceanx-video-"));
    const path = join(dir, "DJI_0012.MP4");
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", path]);
    mp4 = readFileSync(path);
    projectId = (await call(h.projects, "/x", { cookie: admin.cookie, body: { name: "Drone Footage" } })).json.project.id;
  });

  it("ingests: resolution, fps, codec, bitrate, audio, container, duration", async () => {
    const up = await uploadFile(admin.cookie, projectId, "DJI_0012.MP4", mp4);
    mediaId = up.mediaId!;
    await drainJobs();
    const m = await db.mediaFile.findUniqueOrThrow({ where: { id: mediaId } });
    expect(m.status).toBe("READY");
    expect([m.width, m.height, m.fps, m.codec, m.audioCodec]).toEqual([1280, 720, 30, "h264", "aac"]);
    expect(m.duration).toBeCloseTo(2, 0);
    expect(m.container).toContain("mp4");
    expect(Number(m.bitrate)).toBeGreaterThan(0);
    expect(m.previewKey).toMatch(/proxy\.mp4$/);
    expect(m.checksum).toBe(sha256(mp4));
  });

  it("enhances to 4K in the worker, preserving fps and audio", async () => {
    const original = await db.mediaVersion.findFirstOrThrow({ where: { mediaId, isMasterRef: true } });
    const r = await call(h.processVideo, "/x", {
      cookie: admin.cookie,
      body: { settings: { sourceVersionId: original.id, denoise: true, sharpen: true, colorCorrection: true, color: { preset: "Surf Documentary", intensity: 70 }, output: { resolution: "4k", codec: "h264" } } },
    });
    expect(r.status).toBe(202);
    await drainJobs();
    const job = await db.processingJob.findUniqueOrThrow({ where: { id: r.json.job.id } });
    expect(job.errorMessage).toBeNull();
    const v = await db.mediaVersion.findUniqueOrThrow({ where: { id: job.outputVersionId! } });
    expect(v.label).toBe("4K ENHANCED");
    expect(v.isAi).toBe(false);
    expect([v.width, v.height, v.fps]).toEqual([3840, 2160, 30]);
    expect(v.filename).toBe("DJI_0012_4k_surf-documentary.mp4");

    // AI upscale / deblur are refused (not faked) without an AI video provider
    const ai = await call(h.processVideo, "/x", { cookie: admin.cookie, body: { settings: { sourceVersionId: original.id, aiUpscale: true } } });
    await drainJobs();
    expect((await db.processingJob.findUniqueOrThrow({ where: { id: ai.json.job.id } })).errorMessage).toMatch(/AI video upscale requires/);

    // publish original + 4K and download both exactly
    await call(h.publishVersion, "/x", { cookie: admin.cookie, params: { id: v.id }, body: { published: true } });
    await call(h.publishVersion, "/x", { cookie: admin.cookie, params: { id: original.id }, body: { published: true } });
    const clientId = (await call(h.clients, "/x", { cookie: admin.cookie, body: { name: "Drone client" } })).json.client.id;
    const d = await call(h.createDelivery, "/x", { cookie: admin.cookie, body: { projectId, clientId, versionIds: [original.id, v.id] } });
    await drainJobs();
    const token = tokenFromLink(d.json.link);
    const login = await call(h.clientLogin, "/x", { body: { token, password: d.json.password }, ip: "192.0.2.88" });
    const g = await call(h.clientGallery, `/x?token=${token}`, { cookie: login.cookie });
    expect(g.json.files.every((f: { mediaType: string }) => f.mediaType === "VIDEO")).toBe(true);
    for (const f of g.json.files) {
      const dl = await call(h.clientDownload, "/x", { cookie: login.cookie, body: { token, fileId: f.id } });
      const bytes = Buffer.from(await (await fetch(dl.json.url)).arrayBuffer());
      const expected = f.label === "ORIGINAL" ? sha256(mp4) : v.checksum;
      expect(sha256(bytes)).toBe(expected); // original returned exactly — never transcoded
    }
    const dir = mkdtempSync(join(tmpdir(), "oceanx-video-out-"));
    const out = join(dir, "4k.mp4");
    const adl = await call(h.adminDownload, "/x", { cookie: admin.cookie, params: { id: v.id }, body: {} });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(out, Buffer.from(await (await fetch(adl.json.url)).arrayBuffer()));
    const p = await probeVideo(out);
    expect(p.audioCodec).toBe("aac");
    expect(p.fps).toBe(30);
  });
});
