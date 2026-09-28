import { PassThrough } from "node:stream";
import { ZipArchive } from "archiver";
import type { Storage } from "@/lib/storage/s3";

export interface ZipEntry {
  key: string;
  filename: string;
  size: number;
}

/**
 * Split a delivery into ZIP parts no larger than maxBytes (a single file larger
 * than the limit gets its own part). Order is preserved.
 */
export function planZipParts(entries: ZipEntry[], maxBytes: number): ZipEntry[][] {
  const parts: ZipEntry[][] = [];
  let current: ZipEntry[] = [];
  let size = 0;
  for (const e of entries) {
    if (current.length > 0 && size + e.size > maxBytes) {
      parts.push(current);
      current = [];
      size = 0;
    }
    current.push(e);
    size += e.size;
  }
  if (current.length) parts.push(current);
  return parts;
}

/** Make filenames unique inside one archive (DSC_0001.jpg, DSC_0001 (2).jpg …). */
export function uniqueNames(entries: ZipEntry[]): ZipEntry[] {
  const seen = new Map<string, number>();
  return entries.map((e) => {
    const lower = e.filename.toLowerCase();
    const n = seen.get(lower) ?? 0;
    seen.set(lower, n + 1);
    if (n === 0) return e;
    const dot = e.filename.lastIndexOf(".");
    const name = dot > 0 ? `${e.filename.slice(0, dot)} (${n + 1})${e.filename.slice(dot)}` : `${e.filename} (${n + 1})`;
    return { ...e, filename: name };
  });
}

/**
 * Stream objects from storage into a STORE (uncompressed — files are already
 * compressed media and must stay byte-identical) ZIP64 archive and stream the
 * archive straight back to storage. Nothing is buffered in memory or on disk.
 */
export async function buildZip(storage: Storage, entries: ZipEntry[], destKey: string): Promise<void> {
  const archive = new ZipArchive({ store: true, forceZip64: true });
  const pass = new PassThrough();
  archive.pipe(pass);
  const upload = storage.uploadStream(destKey, pass, "application/zip");
  const errors: unknown[] = [];
  archive.on("error", (e: unknown) => errors.push(e));
  for (const e of uniqueNames(entries)) {
    const body = await storage.getStream(e.key);
    archive.append(body, { name: e.filename, store: true });
    // wait for this entry to be fully consumed before opening the next stream
    await new Promise<void>((resolve, reject) => {
      archive.once("entry", () => resolve());
      archive.once("error", reject);
    });
  }
  await archive.finalize();
  await upload;
  if (errors.length) throw errors[0];
}
