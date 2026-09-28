/**
 * §91 CRITICAL MASTER TEST (and §69 master preservation, §90 RAW acceptance).
 *
 * Real Nikon NEF → SHA-256 → RAW develop → AI/enhancement pipeline with 8×
 * upscale → color grade → export TIFF → publish → client delivery → client
 * download → expire → cleanup → re-verify the NEF → new 48-hour delivery.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { advanceClock, resetClock } from "@/lib/clock";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage/s3";
import { keys } from "@/lib/storage/keys";
import { hashObject } from "@/workers/context";
import { call, createAdmin, drainJobs, fixture, handlers, sha256, tokenFromLink, uploadFile } from "./helpers";

const H = 3600_000;

describe("CRITICAL MASTER TEST — Nikon NEF", () => {
  let admin: { cookie: string };
  let h: Awaited<ReturnType<typeof handlers>>;
  let nef: Buffer;
  let originalChecksum: string;
  let projectId: string;
  let clientId: string;
  let mediaId: string;
  let finalVersionId: string;
  let deliveryId: string;
  let token: string;
  let password: string;

  beforeAll(async () => {
    h = await handlers();
    admin = await createAdmin();
    nef = await fixture("nikon_d1.NEF");
    originalChecksum = sha256(nef);
  });
  afterAll(() => resetClock());

  it("1–3. uploads the NEF, calculates and saves its SHA-256", async () => {
    const p = await call(h.projects, "/api/admin/projects", { cookie: admin.cookie, body: { name: "Surf Session" } });
    expect(p.status).toBe(201);
    projectId = p.json.project.id;
    const c = await call(h.clients, "/api/admin/clients", { cookie: admin.cookie, body: { name: "Test Client" } });
    clientId = c.json.client.id;

    const up = await uploadFile(admin.cookie, projectId, "DSC_1234.NEF", nef);
    expect(up.status).toBe(200);
    mediaId = up.mediaId!;
    await drainJobs();

    const media = await db.mediaFile.findUniqueOrThrow({ where: { id: mediaId }, include: { metadata: true, versions: true } });
    expect(media.status).toBe("READY");
    expect(media.mediaType).toBe("RAW");
    expect(media.checksum).toBe(originalChecksum);
    expect(media.storageKey).toBe(keys.master(projectId, mediaId));
    expect(media.width).toBe(2012);
    expect(media.height).toBe(1324);
    expect(media.metadata?.cameraMake).toBe("NIKON CORPORATION");
    expect(media.metadata?.cameraModel).toBe("NIKON D1");
    expect(media.previewKey).toBeTruthy();
    // staging object promoted and removed; master stored byte-for-byte
    expect(await storage().head(keys.staging(mediaId))).toBeNull();
    expect(await hashObject(media.storageKey)).toBe(originalChecksum);
    const original = media.versions.find((v) => v.isMasterRef)!;
    expect(original.label).toBe("ORIGINAL RAW");
    expect(original.storageKey).toBe(media.storageKey);
  });

  it("4. develops the RAW into a new 16-bit version (NEF untouched)", async () => {
    const original = await db.mediaVersion.findFirstOrThrow({ where: { mediaId, isMasterRef: true } });
    const res = await call(h.processPhoto, "/api/admin/process/photo", {
      cookie: admin.cookie,
      body: { settings: { sourceVersionId: original.id, raw: { exposure: 0.3, shadows: 15, vibrance: 10 }, output: { format: "tiff16" } } },
    });
    expect(res.status).toBe(202);
    await drainJobs();
    const job = await db.processingJob.findUniqueOrThrow({ where: { id: res.json.job.id } });
    expect(job.status).toBe("COMPLETED");
    const v = await db.mediaVersion.findUniqueOrThrow({ where: { id: job.outputVersionId! } });
    expect(v.versionType).toBe("RAW_DEVELOPED");
    expect(v.label).toBe("RAW DEVELOPED");
    expect(v.filename).toBe("DSC_1234_developed.tif");
    expect(v.mimeType).toBe("image/tiff");
    expect([v.width, v.height]).toEqual([2012, 1324]);
  });

  it("5–6. denoise + 8× upscale + Ocean Blue color grade → 8× TIFF derivative", async () => {
    const original = await db.mediaVersion.findFirstOrThrow({ where: { mediaId, isMasterRef: true } });
    const res = await call(h.processPhoto, "/api/admin/process/photo", {
      cookie: admin.cookie,
      body: {
        settings: {
          sourceVersionId: original.id,
          raw: {},
          enhance: { denoise: true, detailRecovery: true, upscale: 8, facePreservation: true, quality: "natural" },
          color: { preset: "Ocean Blue", intensity: 65 },
          output: { format: "tiff16" },
          acknowledgeLargeOutput: true,
        },
      },
    });
    expect(res.status).toBe(202);
    await drainJobs();
    const job = await db.processingJob.findUniqueOrThrow({ where: { id: res.json.job.id } });
    expect(job.errorMessage).toBeNull();
    expect(job.status).toBe("COMPLETED");
    const v = await db.mediaVersion.findUniqueOrThrow({ where: { id: job.outputVersionId! } });
    expect([v.width, v.height]).toEqual([2012 * 8, 1324 * 8]);
    expect(v.scale).toBe(8);
    expect(v.isAi).toBe(false); // classical engine in tests → never labelled AI
    expect(v.label).toBe("ENHANCED 8× + OCEAN BLUE");
    expect(v.filename).toBe("DSC_1234_8x_enhanced_ocean-blue.tif");
    expect(v.storageKey).toBe(keys.version(projectId, mediaId, v.id));
    const head = await storage().head(v.storageKey);
    expect(head?.size).toBe(Number(v.size));
    expect(await hashObject(v.storageKey)).toBe(v.checksum);
    expect(Array.isArray(v.fidelity) && (v.fidelity as { passed: boolean }[]).every((f) => f.passed)).toBe(true);
    finalVersionId = v.id;
    // master still byte-identical
    expect(await hashObject(keys.master(projectId, mediaId))).toBe(originalChecksum);
  });

  it("7–9. publishes the final, creates a delivery and the client downloads the exact file", async () => {
    // unpublished versions cannot be delivered
    const bad = await call(h.createDelivery, "/api/admin/deliveries", { cookie: admin.cookie, body: { projectId, clientId, versionIds: [finalVersionId] } });
    expect(bad.status).toBe(400);

    const pub = await call(h.publishVersion, `/api/admin/versions/${finalVersionId}/publish`, { cookie: admin.cookie, params: { id: finalVersionId }, body: { published: true } });
    expect(pub.status).toBe(200);
    const original = await db.mediaVersion.findFirstOrThrow({ where: { mediaId, isMasterRef: true } });
    await call(h.publishVersion, `/api/admin/versions/${original.id}/publish`, { cookie: admin.cookie, params: { id: original.id }, body: { published: true } });

    const d = await call(h.createDelivery, "/api/admin/deliveries", {
      cookie: admin.cookie,
      body: { projectId, clientId, title: "John's Surf Session", versionIds: [finalVersionId, original.id], buildZip: true },
    });
    expect(d.status).toBe(201);
    deliveryId = d.json.deliveryId;
    token = tokenFromLink(d.json.link);
    password = d.json.password;
    const delivery = await db.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
    expect(delivery.expiresAt.getTime() - delivery.createdAt.getTime()).toBe(48 * H);
    expect(delivery.passwordHash).not.toContain(password);
    await drainJobs();
    expect((await db.delivery.findUniqueOrThrow({ where: { id: deliveryId } })).status).toBe("ACTIVE");

    const login = await call(h.clientLogin, "/api/client/login", { body: { token, password } });
    expect(login.status).toBe(200);
    const g = await call(h.clientGallery, `/api/client/gallery?token=${token}`, { cookie: login.cookie });
    expect(g.status).toBe(200);
    expect(g.json.files).toHaveLength(2);
    const final = g.json.files.find((f: { label: string }) => f.label.startsWith("ENHANCED 8×"));
    const raw = g.json.files.find((f: { label: string }) => f.label === "ORIGINAL RAW");
    expect(g.json.packages).toHaveLength(1);

    for (const [file, expected] of [
      [final, (await db.mediaVersion.findUniqueOrThrow({ where: { id: finalVersionId } })).checksum],
      [raw, originalChecksum],
    ] as const) {
      const dl = await call(h.clientDownload, "/api/client/download", { cookie: login.cookie, body: { token, fileId: file.id } });
      expect(dl.status).toBe(200);
      expect(dl.json.url).toContain(`/deliveries/${deliveryId}/files/`);
      expect(dl.json.expiresIn).toBeLessThanOrEqual(900);
      const bytes = Buffer.from(await (await fetch(dl.json.url)).arrayBuffer());
      expect(sha256(bytes)).toBe(expected); // exact published file, not a re-encode
    }
    const zip = await call(h.clientDownload, "/api/client/download", { cookie: login.cookie, body: { token, packageId: g.json.packages[0].id } });
    expect(zip.status).toBe(200);
    expect(await db.download.count({ where: { deliveryId } })).toBe(3);
  });

  it("10–12. expires, deletes temporary assets, and the NEF is unchanged and downloadable", async () => {
    const login = await call(h.clientLogin, "/api/client/login", { body: { token, password } });
    advanceClock(48 * H); // exactly at expires_at
    // access denied immediately — before any cleanup ran
    const g = await call(h.clientGallery, `/api/client/gallery?token=${token}`, { cookie: login.cookie });
    expect(g.status).toBe(410);
    expect((await db.delivery.findUniqueOrThrow({ where: { id: deliveryId } })).status).toBe("ACTIVE");

    const cron = await call(h.cron, "/api/cron/cleanup", { headers: { authorization: "Bearer integration-cron-secret" } });
    expect(cron.status).toBe(200);
    const d = await db.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
    expect(d.status).toBe("DELETED");
    expect(await storage().list(keys.deliveryPrefix(deliveryId))).toHaveLength(0);
    // idempotent
    const again = await call(h.cron, "/api/cron/cleanup", { headers: { authorization: "Bearer integration-cron-secret" } });
    expect(again.status).toBe(200);

    // Expected: original NEF exists, checksum unchanged, accessible to admin.
    // (48 h later the admin's 12-hour session has expired too — sign in again.)
    admin = await createAdmin();
    const media = await db.mediaFile.findUniqueOrThrow({ where: { id: mediaId } });
    expect(await storage().head(media.storageKey)).not.toBeNull();
    expect(await hashObject(media.storageKey)).toBe(originalChecksum);
    expect(media.checksum).toBe(originalChecksum);
    const original = await db.mediaVersion.findFirstOrThrow({ where: { mediaId, isMasterRef: true } });
    const adl = await call(h.adminDownload, `/api/admin/versions/${original.id}/download`, { cookie: admin.cookie, params: { id: original.id }, body: {} });
    expect(adl.status).toBe(200);
    expect(sha256(Buffer.from(await (await fetch(adl.json.url)).arrayBuffer()))).toBe(originalChecksum);
    // permanent derivatives survive too
    const final = await db.mediaVersion.findUniqueOrThrow({ where: { id: finalVersionId } });
    expect(await storage().head(final.storageKey)).not.toBeNull();
  });

  it("new 48-hour delivery CAN BE CREATED from the same masters without re-upload", async () => {
    const res = await call(h.renew, `/api/admin/deliveries/${deliveryId}/renew`, { cookie: admin.cookie, params: { id: deliveryId }, body: {} });
    expect(res.status).toBe(201);
    await drainJobs();
    const newToken = tokenFromLink(res.json.link);
    const login = await call(h.clientLogin, "/api/client/login", { body: { token: newToken, password: res.json.password } });
    expect(login.status).toBe(200);
    const g = await call(h.clientGallery, `/api/client/gallery?token=${newToken}`, { cookie: login.cookie });
    expect(g.status).toBe(200);
    expect(g.json.files).toHaveLength(2);
    expect(await db.mediaFile.count({ where: { projectId } })).toBe(1); // no duplicate master
  });
});
