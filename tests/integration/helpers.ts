import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";
import { expect } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { dispatch } from "@/workers/dispatch";

export const ORIGIN = "http://localhost:3000";

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export interface CallOptions {
  method?: string;
  body?: unknown;
  cookie?: string;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  ip?: string;
}

/** Invoke a Next.js route handler exactly as the runtime would. */
export async function call(handler: Handler, path: string, o: CallOptions = {}) {
  const method = o.method ?? (o.body !== undefined ? "POST" : "GET");
  const headers: Record<string, string> = {
    origin: ORIGIN,
    "x-forwarded-for": o.ip ?? "203.0.113.10",
    "user-agent": "vitest",
    ...(o.body !== undefined ? { "content-type": "application/json" } : {}),
    ...(o.cookie ? { cookie: o.cookie } : {}),
    ...o.headers,
  };
  const req = new NextRequest(`${ORIGIN}${path}`, { method, headers, body: o.body !== undefined ? JSON.stringify(o.body) : undefined });
  const res = await handler(req, { params: Promise.resolve(o.params ?? {}) });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  return { status: res.status, json: json as Record<string, any>, cookie, headers: res.headers }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export async function createAdmin(email = `admin-${randomBytes(4).toString("hex")}@oceanx.test`, password = "admin-password-1234") {
  await db.adminUser.create({ data: { email, name: "Test Admin", passwordHash: await hashPassword(password), role: "OWNER" } });
  const login = (await import("@/app/api/admin/auth/login/route")).POST as unknown as Handler;
  const res = await call(login, "/api/admin/auth/login", { body: { email, password }, ip: `198.51.100.${Math.floor(Math.random() * 200)}` });
  expect(res.status).toBe(200);
  return { email, password, cookie: res.cookie };
}

export function sha256(buf: Buffer) {
  return createHash("sha256").update(buf).digest("hex");
}

/** Browser-equivalent direct multipart upload through presigned part URLs. */
export async function uploadFile(adminCookie: string, projectId: string, filename: string, data: Buffer) {
  const create = (await import("@/app/api/admin/uploads/create/route")).POST as unknown as Handler;
  const sign = (await import("@/app/api/admin/uploads/sign-parts/route")).POST as unknown as Handler;
  const complete = (await import("@/app/api/admin/uploads/complete/route")).POST as unknown as Handler;
  const c = await call(create, "/api/admin/uploads/create", { cookie: adminCookie, body: { projectId, filename, size: data.length } });
  if (c.status !== 201) return { status: c.status, json: c.json };
  const { mediaId, partSize, partCount } = c.json as { mediaId: string; partSize: number; partCount: number };
  const nums = Array.from({ length: partCount }, (_, i) => i + 1);
  const s = await call(sign, "/api/admin/uploads/sign-parts", { cookie: adminCookie, body: { mediaId, partNumbers: nums } });
  expect(s.status).toBe(200);
  const parts: { partNumber: number; etag: string }[] = [];
  for (const n of nums) {
    const chunk = data.subarray((n - 1) * partSize, Math.min(data.length, n * partSize));
    const put = await fetch(s.json.urls[n], { method: "PUT", body: new Uint8Array(chunk) });
    expect(put.status).toBe(200);
    parts.push({ partNumber: n, etag: put.headers.get("etag")! });
  }
  const done = await call(complete, "/api/admin/uploads/complete", { cookie: adminCookie, body: { mediaId, parts } });
  return { status: done.status, json: done.json, mediaId };
}

/** Run queued jobs in-process (the same code the BullMQ worker executes) until the queue is drained. */
export async function drainJobs(maxRounds = 20) {
  for (let i = 0; i < maxRounds; i++) {
    const queued = await db.processingJob.findMany({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" } });
    if (queued.length === 0) return;
    for (const j of queued) await dispatch(j.id).catch(() => undefined);
  }
}

export async function fixture(name: string) {
  return readFile(new URL(`../fixtures/${name}`, import.meta.url));
}

export async function handlers() {
  return {
    projects: (await import("@/app/api/admin/projects/route")).POST as unknown as Handler,
    clients: (await import("@/app/api/admin/clients/route")).POST as unknown as Handler,
    processPhoto: (await import("@/app/api/admin/process/photo/route")).POST as unknown as Handler,
    processVideo: (await import("@/app/api/admin/process/video/route")).POST as unknown as Handler,
    publishVersion: (await import("@/app/api/admin/versions/[id]/publish/route")).POST as unknown as Handler,
    mediaPublish: (await import("@/app/api/admin/media/[id]/publish/route")).POST as unknown as Handler,
    mediaUnpublish: (await import("@/app/api/admin/media/[id]/unpublish/route")).POST as unknown as Handler,
    adminDownload: (await import("@/app/api/admin/versions/[id]/download/route")).POST as unknown as Handler,
    createDelivery: (await import("@/app/api/admin/deliveries/route")).POST as unknown as Handler,
    listDeliveries: (await import("@/app/api/admin/deliveries/route")).GET as unknown as Handler,
    revoke: (await import("@/app/api/admin/deliveries/[id]/revoke/route")).POST as unknown as Handler,
    renew: (await import("@/app/api/admin/deliveries/[id]/renew/route")).POST as unknown as Handler,
    secrets: (await import("@/app/api/admin/deliveries/[id]/secrets/route")).GET as unknown as Handler,
    jobs: (await import("@/app/api/admin/jobs/route")).GET as unknown as Handler,
    retry: (await import("@/app/api/admin/jobs/[id]/retry/route")).POST as unknown as Handler,
    deleteProject: (await import("@/app/api/admin/projects/[id]/route")).DELETE as unknown as Handler,
    clientLogin: (await import("@/app/api/client/login/route")).POST as unknown as Handler,
    clientGallery: (await import("@/app/api/client/gallery/route")).GET as unknown as Handler,
    clientMedia: (await import("@/app/api/client/media/route")).GET as unknown as Handler,
    clientDownload: (await import("@/app/api/client/download/route")).POST as unknown as Handler,
    clientFavorite: (await import("@/app/api/client/favorite/route")).POST as unknown as Handler,
    cron: (await import("@/app/api/cron/cleanup/route")).GET as unknown as Handler,
  };
}

export function tokenFromLink(link: string) {
  return link.split("/gallery/")[1]!;
}
