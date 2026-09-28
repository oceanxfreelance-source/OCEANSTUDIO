/** §90 PHOTO acceptance: JPG → enhance → 4× → 8× → color grade → publish → download; retry never duplicates. */
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashObject } from "@/workers/context";
import { call, createAdmin, drainJobs, handlers, sha256, tokenFromLink, uploadFile } from "./helpers";

describe("photo pipeline", () => {
  let h: Awaited<ReturnType<typeof handlers>>;
  let admin: { cookie: string };
  let projectId: string, mediaId: string, originalId: string, masterSha: string;

  beforeAll(async () => {
    h = await handlers();
    admin = await createAdmin();
    projectId = (await call(h.projects, "/x", { cookie: admin.cookie, body: { name: "Outdoor Portrait" } })).json.project.id;
    // textured test image with an EXIF orientation tag
    const noise = Buffer.alloc(800 * 533 * 3);
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 7919) % 251;
    const jpg = await sharp(noise, { raw: { width: 800, height: 533, channels: 3 } }).blur(1.2).jpeg({ quality: 93 }).withMetadata({ orientation: 1 }).toBuffer();
    masterSha = sha256(jpg);
    const up = await uploadFile(admin.cookie, projectId, "DSC_0042.jpg", jpg);
    mediaId = up.mediaId!;
    await drainJobs();
    originalId = (await db.mediaVersion.findFirstOrThrow({ where: { mediaId, isMasterRef: true } })).id;
  });

  const run = async (settings: Record<string, unknown>) => {
    const r = await call(h.processPhoto, "/x", { cookie: admin.cookie, body: { settings: { sourceVersionId: originalId, ...settings } } });
    expect(r.status).toBe(202);
    await drainJobs();
    const job = await db.processingJob.findUniqueOrThrow({ where: { id: r.json.job.id } });
    return { job, version: job.outputVersionId ? await db.mediaVersion.findUniqueOrThrow({ where: { id: job.outputVersionId } }) : null };
  };

  it("enhances (auto + denoise + detail) as a new version", async () => {
    const { job, version } = await run({ enhance: { autoEnhance: true, denoise: true, detailRecovery: true, sharpen: true }, output: { format: "tiff16" } });
    expect(job.status).toBe("COMPLETED");
    expect(version!.label).toBe("ENHANCED");
    expect([version!.width, version!.height]).toEqual([800, 533]);
    expect((version!.settings as { steps: string[] }).steps).toEqual(expect.arrayContaining(["ANALYSIS", "DENOISE", "DETAIL RESTORATION", "FACE PRESERVATION"]));
  });

  it("upscales 4× and 8× exactly", async () => {
    const four = await run({ enhance: { upscale: 4 }, output: { format: "png" } });
    expect([four.version!.width, four.version!.height]).toEqual([3200, 2132]);
    expect(four.version!.label).toBe("ENHANCED 4×");
    expect(four.version!.mimeType).toBe("image/png");
    const eight = await run({ enhance: { upscale: 8 }, color: { preset: "Golden Hour", intensity: 80 }, output: { format: "jpeg", jpegQuality: 97 }, acknowledgeLargeOutput: true });
    expect([eight.version!.width, eight.version!.height]).toEqual([6400, 4264]);
    expect(eight.version!.filename).toBe("DSC_0042_8x_enhanced_golden-hour.jpg");
    const meta = await sharp(Buffer.from(await (await fetch((await call(h.adminDownload, "/x", { cookie: admin.cookie, params: { id: eight.version!.id }, body: {} })).json.url)).arrayBuffer())).metadata();
    expect([meta.width, meta.height]).toEqual([6400, 4264]);
  });

  it("refuses 8× without the large-file acknowledgement", async () => {
    const r = await call(h.processPhoto, "/x", { cookie: admin.cookie, body: { settings: { sourceVersionId: originalId, enhance: { upscale: 8 } } } });
    expect(r.status).toBe(400);
  });

  it("color grades, publishes and the client downloads the exact JPEG", async () => {
    const { version } = await run({ color: { preset: "Cinematic", intensity: 100, adjustments: { exposure: 0.2 } }, output: { format: "jpeg" } });
    expect(version!.versionType).toBe("COLOR_GRADED");
    expect(version!.label).toBe("COLOR GRADED · CINEMATIC");
    await call(h.publishVersion, "/x", { cookie: admin.cookie, params: { id: version!.id }, body: { published: true } });
    const clientId = (await call(h.clients, "/x", { cookie: admin.cookie, body: { name: "Portrait client" } })).json.client.id;
    const d = await call(h.createDelivery, "/x", { cookie: admin.cookie, body: { projectId, clientId, versionIds: [version!.id], buildZip: false } });
    await drainJobs();
    const token = tokenFromLink(d.json.link);
    const login = await call(h.clientLogin, "/x", { body: { token, password: d.json.password }, ip: "192.0.2.77" });
    const g = await call(h.clientGallery, `/x?token=${token}`, { cookie: login.cookie });
    const dl = await call(h.clientDownload, "/x", { cookie: login.cookie, body: { token, fileId: g.json.files[0].id } });
    const bytes = Buffer.from(await (await fetch(dl.json.url)).arrayBuffer());
    expect(sha256(bytes)).toBe(version!.checksum);
    const fav = await call(h.clientFavorite, "/x", { cookie: login.cookie, body: { token, fileId: g.json.files[0].id, favorite: true } });
    expect(fav.status).toBe(200);
    expect(await db.favorite.count({ where: { mediaId } })).toBe(1);
  });

  it("failed jobs retry without duplicating masters or versions", async () => {
    const r = await call(h.processPhoto, "/x", { cookie: admin.cookie, body: { settings: { sourceVersionId: originalId, enhance: { deblur: true } } } });
    await drainJobs();
    const failed = await db.processingJob.findUniqueOrThrow({ where: { id: r.json.job.id } });
    expect(failed.status).toBe("FAILED");
    expect(failed.errorMessage).toMatch(/Motion deblur requires an AI image provider/);
    const before = await db.mediaVersion.count({ where: { mediaId } });
    const retry = await call(h.retry, "/x", { cookie: admin.cookie, params: { id: failed.id }, body: {} });
    expect(retry.status).toBe(200);
    await drainJobs();
    expect((await db.processingJob.findUniqueOrThrow({ where: { id: failed.id } })).attempts).toBe(1);
    expect(await db.mediaVersion.count({ where: { mediaId } })).toBe(before);
    expect(await db.mediaFile.count({ where: { projectId } })).toBe(1);
    // retrying a completed job's work is idempotent by processing job id
    const completed = await db.processingJob.findFirstOrThrow({ where: { mediaId, status: "COMPLETED", jobType: "COLOR_GRADE" } });
    await db.processingJob.update({ where: { id: completed.id }, data: { status: "QUEUED" } });
    await drainJobs();
    expect(await db.mediaVersion.count({ where: { processingJobId: completed.id } })).toBe(1);
    expect(await hashObject((await db.mediaFile.findUniqueOrThrow({ where: { id: mediaId } })).storageKey)).toBe(masterSha);
  });
});
