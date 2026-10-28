import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { del, get, issueSignedToken, presignUrl, put } from "@vercel/blob";

/**
 * File storage for the clip shop.
 *
 *  - PRIVATE: originals, payment slips, delivered reels. Never public; reached
 *    only through short-lived signed links handed out after checks.
 *  - PUBLIC: small watermarked previews and their cover frames.
 *
 * Production uses Vercel Blob: a private store (PRIVATE_BLOB_READ_WRITE_TOKEN)
 * and the existing public store (BLOB_READ_WRITE_TOKEN). Without the private
 * token outside production, files go to ./.data on disk so the whole flow
 * works in development and tests. Swapping in Cloudflare R2 later only means
 * adding a driver here.
 */
type Driver = "vercel" | "local";

export class StorageError extends Error {}

function driver(): Driver {
  if (process.env.PRIVATE_BLOB_READ_WRITE_TOKEN) return "vercel";
  if (process.env.NODE_ENV !== "production" || process.env.STORAGE_DRIVER === "local") return "local";
  throw new StorageError("Private file storage is not connected (PRIVATE_BLOB_READ_WRITE_TOKEN missing).");
}

export function storageReady(): boolean {
  try {
    driver();
    return true;
  } catch {
    return false;
  }
}

export function storageDriver(): Driver {
  return driver();
}

const privateToken = () => process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;
const LOCAL_ROOT = resolve(process.env.LOCAL_STORAGE_DIR ?? ".data");

function localPath(area: "private" | "public", key: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,300}$/.test(key) || key.includes("..")) throw new StorageError("Bad file key");
  return join(LOCAL_ROOT, area, key);
}

// ── Local signing (dev/test) ────────────────────────────────────────────────
function localSecret(): string {
  return process.env.SESSION_SECRET ?? process.env.DATABASE_URL ?? "local-dev-secret";
}
export function signLocal(parts: string): string {
  return createHmac("sha256", localSecret()).update(parts).digest("base64url");
}
export function verifyLocal(parts: string, sig: string): boolean {
  const want = Buffer.from(signLocal(parts));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

// ── Private files ───────────────────────────────────────────────────────────
export async function putPrivate(key: string, body: Buffer, contentType: string): Promise<string> {
  if (driver() === "vercel") {
    const r = await put(key, body, { access: "private", contentType, token: privateToken(), addRandomSuffix: true });
    return r.pathname;
  }
  const path = localPath("private", key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
  return key;
}

/** Save a private file to a local path (e.g. for ffmpeg). */
export async function downloadPrivate(key: string, to: string): Promise<void> {
  if (driver() === "vercel") {
    const r = await get(key, { access: "private", token: privateToken() });
    if (!r || r.statusCode !== 200 || !r.stream) throw new StorageError("File not found in storage");
    await pipeline(Readable.fromWeb(r.stream as unknown as WebReadableStream), createWriteStream(to));
    return;
  }
  await pipeline(createReadStream(localPath("private", key)), createWriteStream(to));
}

/** Stream a private file (used for admin slip viewing). */
export async function readPrivate(key: string): Promise<{ stream: ReadableStream; contentType: string; size?: number } | null> {
  if (driver() === "vercel") {
    const r = await get(key, { access: "private", token: privateToken() });
    if (!r || r.statusCode !== 200 || !r.stream) return null;
    return { stream: r.stream as ReadableStream, contentType: r.blob.contentType };
  }
  try {
    const path = localPath("private", key);
    const s = await stat(path);
    return { stream: Readable.toWeb(createReadStream(path)) as unknown as ReadableStream, contentType: guessType(key), size: s.size };
  } catch {
    return null;
  }
}

/** A link to a private file that stops working after `seconds`. */
export async function signedPrivateUrl(key: string, seconds: number): Promise<string> {
  const validUntil = Date.now() + seconds * 1000;
  if (driver() === "vercel") {
    const token = await issueSignedToken({ pathname: key, operations: ["get"], validUntil, token: privateToken() });
    const { presignedUrl } = await presignUrl(token, { operation: "get", pathname: key, access: "private", validUntil });
    return presignedUrl;
  }
  const exp = String(validUntil);
  return `/api/files/local?key=${encodeURIComponent(key)}&exp=${exp}&sig=${signLocal(`${key}|${exp}`)}`;
}

export async function deletePrivate(key: string | null | undefined): Promise<void> {
  if (!key) return;
  if (driver() === "vercel") {
    await del(key, { token: privateToken() }).catch((e) => console.error("could not delete private file", e));
    return;
  }
  await rm(localPath("private", key), { force: true });
}

// ── Public files (previews) ─────────────────────────────────────────────────
export async function putPublic(key: string, body: Buffer, contentType: string): Promise<string> {
  if (driver() === "vercel") {
    const r = await put(key, body, { access: "public", contentType, addRandomSuffix: true, cacheControlMaxAge: 60 * 60 * 24 * 365 });
    return r.url;
  }
  const path = localPath("public", key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
  return `/api/files/public/${key}`;
}

export async function deletePublic(url: string | null | undefined): Promise<void> {
  if (!url) return;
  if (url.startsWith("/api/files/public/")) {
    await rm(localPath("public", url.slice("/api/files/public/".length)), { force: true }).catch(() => undefined);
    return;
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) await del(url).catch((e) => console.error("could not delete public file", e));
}

/** Local driver only: read a public file. */
export async function readLocalPublic(key: string): Promise<Buffer | null> {
  return readFile(localPath("public", key)).catch(() => null);
}

/** Local driver only: write an uploaded private file. */
export async function writeLocalPrivate(key: string, body: ReadableStream<Uint8Array>): Promise<number> {
  const path = localPath("private", key);
  await mkdir(dirname(path), { recursive: true });
  await pipeline(Readable.fromWeb(body as unknown as WebReadableStream), createWriteStream(path));
  return (await stat(path)).size;
}
export function localPrivatePath(key: string): string {
  return localPath("private", key);
}

export function guessType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  return (
    { mp4: "video/mp4", mov: "video/quicktime", m4v: "video/mp4", webm: "video/webm", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" }[ext ?? ""] ??
    "application/octet-stream"
  );
}
