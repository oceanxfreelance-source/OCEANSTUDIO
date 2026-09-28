/** Upload validation: never trust filename / MIME; resumable multipart; staging never becomes a master unless valid. */
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { keys } from "@/lib/storage/keys";
import { storage } from "@/lib/storage/s3";
import { call, createAdmin, handlers, uploadFile } from "./helpers";

describe("uploads", () => {
  let h: Awaited<ReturnType<typeof handlers>>;
  let admin: { cookie: string };
  let projectId: string;
  beforeAll(async () => {
    h = await handlers();
    admin = await createAdmin();
    projectId = (await call(h.projects, "/x", { cookie: admin.cookie, body: { name: "Event Photography" } })).json.project.id;
  });

  it("rejects unsupported file types", async () => {
    const r = await uploadFile(admin.cookie, projectId, "malware.exe", Buffer.from("MZ...."));
    expect(r.status).toBe(400);
  });

  it("rejects content that does not match its extension and never creates a master", async () => {
    const r = await uploadFile(admin.cookie, projectId, "DSC_9999.NEF", Buffer.from("<html>this is not a raw file</html>".repeat(10)));
    expect(r.status).toBe(400);
    expect(r.json.error.message).toMatch(/not match a valid Nikon NEF/);
    const m = await db.mediaFile.findUniqueOrThrow({ where: { id: r.mediaId! } });
    expect(m.status).toBe("FAILED");
    expect(await storage().head(m.storageKey)).toBeNull();
    expect(await storage().head(keys.staging(m.id))).toBeNull();
    expect(await db.processingJob.count({ where: { mediaId: m.id } })).toBe(0);
  });

  it("supports resuming a multipart upload", async () => {
    const create = (await import("@/app/api/admin/uploads/create/route")).POST as never;
    const sign = (await import("@/app/api/admin/uploads/sign-parts/route")).POST as never;
    const parts = (await import("@/app/api/admin/uploads/[id]/parts/route")).GET as never;
    const data = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(11 * 1024 * 1024, 7)]);
    const c = await call(create, "/x", { cookie: admin.cookie, body: { projectId, filename: "big.jpg", size: data.length } });
    expect(c.json.partCount).toBe(3);
    const s = await call(sign, "/x", { cookie: admin.cookie, body: { mediaId: c.json.mediaId, partNumbers: [1] } });
    await fetch(s.json.urls[1], { method: "PUT", body: new Uint8Array(data.subarray(0, c.json.partSize)) });
    const listed = await call(parts, "/x", { cookie: admin.cookie, params: { id: c.json.mediaId } });
    expect(listed.json.parts.map((p: { partNumber: number }) => p.partNumber)).toEqual([1]);
    const abort = (await import("@/app/api/admin/uploads/abort/route")).POST as never;
    expect((await call(abort, "/x", { cookie: admin.cookie, body: { mediaId: c.json.mediaId } })).status).toBe(200);
  });

  it("requires admin authentication to start an upload", async () => {
    const create = (await import("@/app/api/admin/uploads/create/route")).POST as never;
    const r = await call(create, "/x", { body: { projectId, filename: "a.jpg", size: 10 } });
    expect(r.status).toBe(401);
  });
});
