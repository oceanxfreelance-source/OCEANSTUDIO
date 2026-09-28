/** §70 / §90 SECURITY — every unauthorized attempt must fail server-side. */
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { advanceClock, resetClock } from "@/lib/clock";
import { randomToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { resetRateLimit, RULES } from "@/lib/rate-limit";
import { assertDeletable } from "@/lib/storage/keys";
import { storage } from "@/lib/storage/s3";
import { call, createAdmin, drainJobs, handlers, tokenFromLink, uploadFile } from "./helpers";

const H = 3600_000;

async function jpeg(seed: number) {
  return sharp({ create: { width: 640, height: 427, channels: 3, background: { r: 30 + seed * 40, g: 90, b: 160 } } })
    .jpeg({ quality: 92 })
    .toBuffer();
}

describe("security", () => {
  let h: Awaited<ReturnType<typeof handlers>>;
  let admin: { cookie: string };
  const A = { token: "", password: "", cookie: "", deliveryId: "", fileIds: [] as string[], unpublishedVersionId: "", projectId: "", masterKey: "" };
  const B = { token: "", password: "", cookie: "", deliveryId: "", fileIds: [] as string[], projectId: "" };

  async function setupDelivery(target: typeof A | typeof B, name: string) {
    const p = await call(h.projects, "/api/admin/projects", { cookie: admin.cookie, body: { name } });
    const c = await call(h.clients, "/api/admin/clients", { cookie: admin.cookie, body: { name: `${name} client` } });
    target.projectId = p.json.project.id;
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) ids.push((await uploadFile(admin.cookie, p.json.project.id, `${name}_${i}.jpg`, await jpeg(i))).mediaId!);
    await drainJobs();
    const versions = await db.mediaVersion.findMany({ where: { mediaId: { in: ids } } });
    await call(h.publishVersion, "/x", { cookie: admin.cookie, params: { id: versions[0]!.id }, body: { published: true } });
    await call(h.publishVersion, "/x", { cookie: admin.cookie, params: { id: versions[1]!.id }, body: { published: true } });
    const d = await call(h.createDelivery, "/api/admin/deliveries", {
      cookie: admin.cookie,
      body: { projectId: p.json.project.id, clientId: c.json.client.id, versionIds: versions.map((v) => v.id), buildZip: false },
    });
    expect(d.status).toBe(201);
    await drainJobs();
    target.token = tokenFromLink(d.json.link);
    target.password = d.json.password;
    target.deliveryId = d.json.deliveryId;
    const login = await call(h.clientLogin, "/api/client/login", { body: { token: target.token, password: target.password }, ip: `192.0.2.${name.length}` });
    expect(login.status).toBe(200);
    target.cookie = login.cookie;
    const g = await call(h.clientGallery, `/api/client/gallery?token=${target.token}`, { cookie: target.cookie });
    target.fileIds = g.json.files.map((f: { id: string }) => f.id);
    return versions;
  }

  beforeAll(async () => {
    h = await handlers();
    admin = await createAdmin();
    const va = await setupDelivery(A, "Alpha");
    await setupDelivery(B, "Bravo");
    A.masterKey = (await db.mediaFile.findUniqueOrThrow({ where: { id: va[0]!.mediaId } })).storageKey;
    // a derivative that is never published
    const ok = await call(h.processPhoto, "/api/admin/process/photo", { cookie: admin.cookie, body: { settings: { sourceVersionId: va[0]!.id, color: { preset: "Moody" }, output: { format: "jpeg" } } } });
    expect(ok.status).toBe(202);
    await drainJobs();
    A.unpublishedVersionId = (await db.processingJob.findUniqueOrThrow({ where: { id: ok.json.job.id } })).outputVersionId!;
  });
  afterAll(() => resetClock());
  afterEach(() => resetClock());

  it("client cannot access another delivery with its session", async () => {
    const g = await call(h.clientGallery, `/api/client/gallery?token=${B.token}`, { cookie: A.cookie });
    expect(g.status).toBe(401);
  });

  it("client cannot download another delivery's / project's file by changing IDs", async () => {
    const dl = await call(h.clientDownload, "/api/client/download", { cookie: A.cookie, body: { token: A.token, fileId: B.fileIds[0] } });
    expect(dl.status).toBe(404);
    const m = await call(h.clientMedia, `/api/client/media?token=${A.token}&fileId=${B.fileIds[0]}`, { cookie: A.cookie });
    expect(m.status).toBe(404);
    const fav = await call(h.clientFavorite, "/api/client/favorite", { cookie: A.cookie, body: { token: A.token, fileId: B.fileIds[1], favorite: true } });
    expect(fav.status).toBe(404);
  });

  it("client cannot reach master storage or unpublished versions", async () => {
    // download ids are delivery-file ids; master/version ids are rejected
    const master = await db.mediaVersion.findFirstOrThrow({ where: { projectId: A.projectId, isMasterRef: true } });
    for (const id of [master.id, master.mediaId, A.unpublishedVersionId]) {
      const r = await call(h.clientDownload, "/api/client/download", { cookie: A.cookie, body: { token: A.token, fileId: id } });
      expect(r.status).toBe(404);
    }
    const ok = await call(h.clientDownload, "/api/client/download", { cookie: A.cookie, body: { token: A.token, fileId: A.fileIds[0] } });
    expect(ok.status).toBe(200);
    expect(new URL(ok.json.url).pathname).toMatch(new RegExp(`/deliveries/${A.deliveryId}/files/`));
    expect(ok.json.url).not.toContain("/masters/");
    // (bucket privacy itself is enforced by the storage provider — see README "Storage setup")
  });

  it("unpublished versions cannot be delivered, and unpublishing hides a delivered file", async () => {
    const r = await call(h.createDelivery, "/api/admin/deliveries", {
      cookie: admin.cookie,
      body: { projectId: A.projectId, clientId: (await db.delivery.findUniqueOrThrow({ where: { id: A.deliveryId } })).clientId, versionIds: [A.unpublishedVersionId] },
    });
    expect(r.status).toBe(400);
    const df = await db.deliveryFile.findUniqueOrThrow({ where: { id: A.fileIds[1] } });
    await call(h.publishVersion, "/x", { cookie: admin.cookie, params: { id: df.versionId }, body: { published: false } });
    const g = await call(h.clientGallery, `/api/client/gallery?token=${A.token}`, { cookie: A.cookie });
    expect(g.json.files.map((f: { id: string }) => f.id)).not.toContain(A.fileIds[1]);
    const dl = await call(h.clientDownload, "/api/client/download", { cookie: A.cookie, body: { token: A.token, fileId: A.fileIds[1] } });
    expect(dl.status).toBe(404);
    await call(h.publishVersion, "/x", { cookie: admin.cookie, params: { id: df.versionId }, body: { published: true } });
  });

  it("client cannot access admin routes", async () => {
    const r = await call(h.jobs, "/api/admin/jobs", { cookie: A.cookie });
    expect(r.status).toBe(401);
    const r2 = await call(h.createDelivery, "/api/admin/deliveries", { cookie: A.cookie, body: {} });
    expect(r2.status).toBe(401);
    const r3 = await call(h.adminDownload, "/x", { cookie: A.cookie, params: { id: A.unpublishedVersionId }, body: {} });
    expect(r3.status).toBe(401);
  });

  it("delivery ids cannot be guessed; brute force is rate limited", async () => {
    for (const t of [randomToken(32), "7H9K2M", A.deliveryId, "../../admin"]) {
      const r = await call(h.clientGallery, `/api/client/gallery?token=${encodeURIComponent(t)}`, { cookie: A.cookie });
      expect(r.status).toBe(404);
    }
    const statuses: number[] = [];
    for (let i = 0; i < 14; i++) {
      statuses.push((await call(h.clientLogin, "/api/client/login", { body: { token: A.token, password: `wrong-${i}` }, ip: "198.18.0.99" })).status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses).toContain(429);
    // the lock-out window elapses (15 min) before the next tests
    await resetRateLimit(RULES.clientLogin, `token:${A.token}`);
    await resetRateLimit(RULES.clientLogin, (await import("@/lib/crypto")).hashIp("198.18.0.99")!);
  });

  it("rejects cross-site state-changing requests (CSRF)", async () => {
    const r = await call(h.createDelivery, "/api/admin/deliveries", { cookie: admin.cookie, body: {}, headers: { origin: "https://evil.example" } });
    expect(r.status).toBe(403);
    const r2 = await call(h.clientDownload, "/api/client/download", { cookie: A.cookie, body: { token: A.token, fileId: A.fileIds[0] }, headers: { origin: "https://evil.example" } });
    expect(r2.status).toBe(403);
  });

  it("revocation denies access immediately", async () => {
    const r = await call(h.revoke, "/x", { cookie: admin.cookie, params: { id: B.deliveryId }, body: {} });
    expect(r.status).toBe(200);
    const g = await call(h.clientGallery, `/api/client/gallery?token=${B.token}`, { cookie: B.cookie });
    expect(g.status).toBe(410);
    const l = await call(h.clientLogin, "/api/client/login", { body: { token: B.token, password: B.password }, ip: "192.0.2.201" });
    expect(l.status).toBe(410);
  });

  it("expired sessions and assets cannot be reused, even before cleanup", async () => {
    advanceClock(48 * H + 1000);
    const g = await call(h.clientGallery, `/api/client/gallery?token=${A.token}`, { cookie: A.cookie });
    expect(g.status).toBe(410);
    const dl = await call(h.clientDownload, "/api/client/download", { cookie: A.cookie, body: { token: A.token, fileId: A.fileIds[0] } });
    expect(dl.status).toBe(410);
    const l = await call(h.clientLogin, "/api/client/login", { body: { token: A.token, password: A.password }, ip: "192.0.2.202" });
    expect(l.status).toBe(410);
  });

  it("cleanup and database refuse to touch masters", async () => {
    expect(() => assertDeletable(A.masterKey, { deliveryId: A.deliveryId })).toThrow();
    await expect(storage().deleteTemporary([A.masterKey], { deliveryId: A.deliveryId })).rejects.toThrow(/protected/);
    await expect(storage().putBuffer(A.masterKey, "overwrite", "text/plain")).rejects.toThrow(/immutable/);
    const media = await db.mediaFile.findFirstOrThrow({ where: { storageKey: A.masterKey } });
    await expect(db.mediaFile.update({ where: { id: media.id }, data: { storageKey: "projects/x/masters/y" } })).rejects.toThrow(/immutable/);
    await expect(db.mediaFile.update({ where: { id: media.id }, data: { checksum: "0".repeat(64) } })).rejects.toThrow(/immutable/);
    await expect(db.mediaFile.delete({ where: { id: media.id } })).rejects.toThrow();
    const del = await call(h.deleteProject, "/x", { method: "DELETE", cookie: admin.cookie, params: { id: A.projectId } });
    expect(del.status).toBe(409);
    expect(await storage().head(A.masterKey)).not.toBeNull();
  });

  it("delivery list never exposes secrets; copy-link requires admin", async () => {
    const l = await call(h.listDeliveries, "/api/admin/deliveries", { cookie: admin.cookie });
    const text = JSON.stringify(l.json);
    for (const k of ["passwordHash", "tokenCiphertext", "passwordCiphertext", "secureTokenHash", A.password, A.token]) expect(text).not.toContain(k);
    const s = await call(h.secrets, "/x", { cookie: A.cookie, params: { id: A.deliveryId } });
    expect(s.status).toBe(401);
    const s2 = await call(h.secrets, "/x", { cookie: admin.cookie, params: { id: A.deliveryId } });
    expect(s2.json.password).toBe(A.password);
  });
});
