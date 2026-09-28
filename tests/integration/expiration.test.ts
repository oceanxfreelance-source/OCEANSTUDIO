/** §68 EXPIRATION TEST (mandatory) + cleanup idempotency and retry. */
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { advanceClock, resetClock } from "@/lib/clock";
import { db } from "@/lib/db";
import { keys } from "@/lib/storage/keys";
import { storage } from "@/lib/storage/s3";
import { cleanupDelivery, runDeliveryCleanup } from "@/server/cleanup";
import { hashObject } from "@/workers/context";
import { call, createAdmin, drainJobs, handlers, sha256, tokenFromLink, uploadFile } from "./helpers";

const H = 3600_000;

describe("48-hour expiration", () => {
  let h: Awaited<ReturnType<typeof handlers>>;
  let admin: { cookie: string };
  let projectId: string, clientId: string, versionId: string, masterKey: string, masterSha: string;
  let deliveryId: string, token: string, password: string;

  beforeAll(async () => {
    h = await handlers();
    admin = await createAdmin();
    projectId = (await call(h.projects, "/x", { cookie: admin.cookie, body: { name: "Wedding Collection" } })).json.project.id;
    clientId = (await call(h.clients, "/x", { cookie: admin.cookie, body: { name: "Couple" } })).json.client.id;
    const jpg = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#406080" } }).jpeg({ quality: 95 }).toBuffer();
    masterSha = sha256(jpg);
    const up = await uploadFile(admin.cookie, projectId, "IMG_0001.jpg", jpg);
    await drainJobs();
    const v = await db.mediaVersion.findFirstOrThrow({ where: { mediaId: up.mediaId } });
    versionId = v.id;
    masterKey = v.storageKey;
    await call(h.publishVersion, "/x", { cookie: admin.cookie, params: { id: v.id }, body: { published: true } });
  });
  afterAll(() => resetClock());

  it("create delivery with expires_at = now + 48 hours; client can access", async () => {
    const d = await call(h.createDelivery, "/x", { cookie: admin.cookie, body: { projectId, clientId, versionIds: [versionId], watermarkPreviews: true } });
    expect(d.status).toBe(201);
    deliveryId = d.json.deliveryId;
    token = tokenFromLink(d.json.link);
    password = d.json.password;
    const row = await db.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(48 * H);
    await drainJobs();
    const login = await call(h.clientLogin, "/x", { body: { token, password } });
    expect(login.status).toBe(200);
    const g = await call(h.clientGallery, `/x?token=${token}`, { cookie: login.cookie });
    expect(g.status).toBe(200);
    expect(g.json.files).toHaveLength(1);
    expect(g.json.packages).toHaveLength(1);
    const temp = await storage().list(keys.deliveryPrefix(deliveryId));
    expect(temp.length).toBeGreaterThanOrEqual(5); // file, preview, thumb, manifest, zip
    // manifest pins the exact version
    const manifest = JSON.parse((await storage().getBuffer(keys.deliveryManifest(deliveryId))).toString());
    expect(manifest.files[0].versionId).toBe(versionId);
    expect(manifest.files[0].checksum).toBe(masterSha);
    // watermark applies to previews only; the download is the exact clean file
    const dl = await call(h.clientDownload, "/x", { cookie: login.cookie, body: { token, fileId: g.json.files[0].id } });
    expect(sha256(Buffer.from(await (await fetch(dl.json.url)).arrayBuffer()))).toBe(masterSha);
    const preview = Buffer.from(await (await fetch(g.json.files[0].previewUrl)).arrayBuffer());
    const original = await db.mediaVersion.findUniqueOrThrow({ where: { id: versionId } });
    const unmarked = await storage().getBuffer(original.previewKey!);
    expect(sha256(preview)).not.toBe(sha256(unmarked));
  });

  it("advance time → client cannot access; cleanup → temporary files disappear, masters remain", async () => {
    const login = await call(h.clientLogin, "/x", { body: { token, password } });
    advanceClock(47 * H + 59 * 60_000);
    expect((await call(h.clientGallery, `/x?token=${token}`, { cookie: login.cookie })).status).toBe(200);
    advanceClock(60_000);
    expect((await call(h.clientGallery, `/x?token=${token}`, { cookie: login.cookie })).status).toBe(410);

    const reports = await runDeliveryCleanup();
    expect(reports.find((r) => r.deliveryId === deliveryId)?.outcome).toBe("deleted");
    expect(await storage().list(keys.deliveryPrefix(deliveryId))).toHaveLength(0);
    const d = await db.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
    expect(d.status).toBe("DELETED");
    expect(d.expiredAt).not.toBeNull();
    expect(await db.session.count({ where: { deliveryId, revokedAt: null } })).toBe(0);
    expect(await hashObject(masterKey)).toBe(masterSha);
    const actions = (await db.auditLog.findMany({ where: { deliveryId } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["DELIVERY_CREATED", "DELIVERY_EXPIRED", "DELIVERY_DELETED", "DOWNLOAD", "CLIENT_LOGIN"]));
    // safe to run many times
    expect((await cleanupDelivery(deliveryId)).outcome).toBe("skipped");
  });

  it("create new delivery → client can access again", async () => {
    const r = await call(h.renew, "/x", { cookie: (await createAdmin()).cookie, params: { id: deliveryId }, body: {} });
    expect(r.status).toBe(201);
    await drainJobs();
    const t = tokenFromLink(r.json.link);
    const login = await call(h.clientLogin, "/x", { body: { token: t, password: r.json.password } });
    expect(login.status).toBe(200);
    expect((await call(h.clientGallery, `/x?token=${t}`, { cookie: login.cookie })).status).toBe(200);
  });

  it("cleanup failures are retried (idempotent, logged)", async () => {
    const adminNow = await createAdmin();
    const d = await call(h.createDelivery, "/x", { cookie: adminNow.cookie, body: { projectId, clientId, versionIds: [versionId], buildZip: false } });
    await drainJobs();
    const id = d.json.deliveryId;
    const s = storage();
    const original = s.deleteTemporary.bind(s);
    let fail = true;
    s.deleteTemporary = async (...args: Parameters<typeof original>) => {
      if (fail) throw new Error("simulated storage outage");
      return original(...args);
    };
    advanceClock(49 * H);
    const first = await cleanupDelivery(id);
    expect(first.outcome).toBe("failed");
    const row = await db.delivery.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("DELETING");
    expect(row.cleanupAttempts).toBe(1);
    expect(row.lastCleanupError).toContain("simulated");
    fail = false;
    const second = await cleanupDelivery(id);
    expect(second.outcome).toBe("deleted");
    s.deleteTemporary = original;
    expect(await s.list(keys.deliveryPrefix(id))).toHaveLength(0);
    expect(await hashObject(masterKey)).toBe(masterSha);
  });
});
