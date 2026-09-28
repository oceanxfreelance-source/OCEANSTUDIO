import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
  UploadPartCopyCommand,
  type CompletedPart,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { env } from "../env";
import { assertDeletable, isMasterKey, type DeleteScope } from "./keys";

export interface ObjectHead {
  size: number;
  etag: string | null;
  contentType: string | null;
  lastModified: Date | null;
  metadata: Record<string, string>;
}

export interface SignedGetOptions {
  expiresIn: number;
  downloadFilename?: string;
  inline?: boolean;
  contentType?: string;
}

const MAX_SINGLE_COPY = 5 * 1024 ** 3; // S3 CopyObject limit
const COPY_PART_SIZE = 512 * 1024 ** 2;

function makeClient(endpoint: string | undefined): S3Client {
  const e = env();
  return new S3Client({
    region: e.STORAGE_REGION,
    endpoint,
    forcePathStyle: e.STORAGE_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: e.STORAGE_ACCESS_KEY, secretAccessKey: e.STORAGE_SECRET_KEY },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

/** RFC 6266 / 5987 content-disposition that preserves the exact original filename. */
export function contentDisposition(filename: string, inline = false): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Private S3-compatible storage (Cloudflare R2, AWS S3, Backblaze B2, ...).
 * The bucket must NOT be public — every read goes through short-lived signed URLs.
 */
export class Storage {
  private readonly client: S3Client;
  private readonly signer: S3Client;
  readonly bucket: string;

  constructor() {
    const e = env();
    this.bucket = e.STORAGE_BUCKET;
    this.client = makeClient(e.STORAGE_ENDPOINT);
    this.signer = e.STORAGE_PUBLIC_ENDPOINT ? makeClient(e.STORAGE_PUBLIC_ENDPOINT) : this.client;
  }

  // ---------------- multipart direct upload (browser → storage) ----------------
  async createMultipartUpload(key: string, contentType: string, metadata: Record<string, string>): Promise<string> {
    const res = await this.client.send(
      new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, Metadata: metadata }),
    );
    if (!res.UploadId) throw new Error("Storage did not return an UploadId");
    return res.UploadId;
  }

  presignUploadPart(key: string, uploadId: string, partNumber: number, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.signer,
      new UploadPartCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }),
      { expiresIn },
    );
  }

  async listParts(key: string, uploadId: string): Promise<{ partNumber: number; etag: string; size: number }[]> {
    const parts: { partNumber: number; etag: string; size: number }[] = [];
    let marker: string | undefined;
    do {
      const res = await this.client.send(
        new ListPartsCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, PartNumberMarker: marker }),
      );
      for (const p of res.Parts ?? []) {
        if (p.PartNumber && p.ETag) parts.push({ partNumber: p.PartNumber, etag: p.ETag, size: p.Size ?? 0 });
      }
      marker = res.IsTruncated ? res.NextPartNumberMarker : undefined;
    } while (marker);
    return parts;
  }

  async completeMultipartUpload(key: string, uploadId: string, parts: CompletedPart[]): Promise<void> {
    const sorted = [...parts].sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0));
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: sorted },
      }),
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.client.send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }));
  }

  // ---------------- reads ----------------
  async head(key: string): Promise<ObjectHead | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        size: Number(res.ContentLength ?? 0),
        etag: res.ETag ?? null,
        contentType: res.ContentType ?? null,
        lastModified: res.LastModified ?? null,
        metadata: res.Metadata ?? {},
      };
    } catch (err) {
      const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (e.name === "NotFound" || e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) return null;
      throw err;
    }
  }

  async getRange(key: string, start: number, endInclusive: number): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=${start}-${endInclusive}` }),
    );
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  async getStream(key: string): Promise<Readable> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return res.Body as Readable;
  }

  async getBuffer(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }

  async downloadToFile(key: string, path: string, onChunk?: (chunk: Buffer) => void): Promise<void> {
    const body = await this.getStream(key);
    if (onChunk) body.on("data", (c: Buffer) => onChunk(c));
    await pipeline(body, createWriteStream(path));
  }

  // ---------------- writes (never to master keys) ----------------
  private assertWritable(key: string): void {
    if (isMasterKey(key)) throw new Error(`Refusing to write to master key ${key}: masters are immutable`);
  }

  /**
   * The ONLY way an object is written under masters/: a server-side copy of a
   * validated staging upload, and only if the master key does not exist yet.
   */
  async promoteToMaster(stagingKey: string, masterKey: string, contentType: string): Promise<void> {
    if (!isMasterKey(masterKey)) throw new Error("promoteToMaster target must be a master key");
    if (!stagingKey.startsWith("uploads/")) throw new Error("promoteToMaster source must be a staging upload");
    if (await this.head(masterKey)) throw new Error(`Master ${masterKey} already exists; masters are never overwritten`);
    await this.copyUnchecked(stagingKey, masterKey, contentType);
  }

  async putBuffer(key: string, body: Buffer | string, contentType: string): Promise<void> {
    this.assertWritable(key);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async uploadFile(key: string, path: string, contentType: string, contentDispositionName?: string): Promise<number> {
    this.assertWritable(key);
    const { size } = await stat(path);
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: createReadStream(path),
        ContentType: contentType,
        ContentDisposition: contentDispositionName ? contentDisposition(contentDispositionName) : undefined,
      },
      partSize: 64 * 1024 ** 2,
      queueSize: 4,
    });
    await upload.done();
    return size;
  }

  async uploadStream(key: string, body: Readable, contentType: string): Promise<void> {
    this.assertWritable(key);
    const upload = new Upload({
      client: this.client,
      params: { Bucket: this.bucket, Key: key, Body: body, ContentType: contentType },
      partSize: 64 * 1024 ** 2,
      queueSize: 4,
    });
    await upload.done();
  }

  /** Server-side copy (no bytes pass through the app). Uses multipart copy above 5 GB. */
  async copy(sourceKey: string, destKey: string, contentType?: string): Promise<void> {
    this.assertWritable(destKey);
    await this.copyUnchecked(sourceKey, destKey, contentType);
  }

  private async copyUnchecked(sourceKey: string, destKey: string, contentType?: string): Promise<void> {
    const head = await this.head(sourceKey);
    if (!head) throw new Error(`Copy source not found: ${sourceKey}`);
    const source = `${this.bucket}/${sourceKey.split("/").map(encodeURIComponent).join("/")}`;
    if (head.size <= MAX_SINGLE_COPY) {
      await this.client.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          Key: destKey,
          CopySource: source,
          ContentType: contentType ?? head.contentType ?? undefined,
          MetadataDirective: contentType ? "REPLACE" : "COPY",
        }),
      );
      return;
    }
    const uploadId = await this.createMultipartUpload(destKey, contentType ?? head.contentType ?? "application/octet-stream", {});
    try {
      const parts: CompletedPart[] = [];
      let partNumber = 1;
      for (let start = 0; start < head.size; start += COPY_PART_SIZE, partNumber++) {
        const end = Math.min(start + COPY_PART_SIZE, head.size) - 1;
        const res = await this.client.send(
          new UploadPartCopyCommand({
            Bucket: this.bucket,
            Key: destKey,
            UploadId: uploadId,
            PartNumber: partNumber,
            CopySource: source,
            CopySourceRange: `bytes=${start}-${end}`,
          }),
        );
        parts.push({ PartNumber: partNumber, ETag: res.CopyPartResult?.ETag });
      }
      await this.completeMultipartUpload(destKey, uploadId, parts);
    } catch (err) {
      await this.abortMultipartUpload(destKey, uploadId).catch(() => undefined);
      throw err;
    }
  }

  // ---------------- signed downloads ----------------
  presignGet(key: string, opts: SignedGetOptions): Promise<string> {
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: opts.downloadFilename
          ? contentDisposition(opts.downloadFilename, opts.inline)
          : undefined,
        ResponseContentType: opts.contentType,
        ResponseCacheControl: "private, no-store",
      }),
      { expiresIn: opts.expiresIn },
    );
  }

  // ---------------- listing ----------------
  async list(prefix: string): Promise<{ key: string; size: number }[]> {
    const out: { key: string; size: number }[] = [];
    let token: string | undefined;
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      for (const o of res.Contents ?? []) if (o.Key) out.push({ key: o.Key, size: Number(o.Size ?? 0) });
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return out;
  }

  // ---------------- guarded deletes ----------------
  /**
   * Delete temporary objects. Every key is checked against assertDeletable():
   * masters, derivatives and anything under projects/ can never be deleted.
   * Returns the keys that were deleted (already-missing keys count as deleted — idempotent).
   */
  async deleteTemporary(keysToDelete: string[], scope: DeleteScope): Promise<string[]> {
    for (const k of keysToDelete) assertDeletable(k, scope);
    const deleted: string[] = [];
    for (let i = 0; i < keysToDelete.length; i += 1000) {
      const batch = keysToDelete.slice(i, i + 1000);
      if (batch.length === 0) continue;
      const res = await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: false },
        }),
      );
      if (res.Errors && res.Errors.length > 0) {
        const msg = res.Errors.map((e) => `${e.Key}: ${e.Code} ${e.Message}`).join("; ");
        throw new Error(`Failed to delete ${res.Errors.length} object(s): ${msg}`);
      }
      deleted.push(...batch);
    }
    return deleted;
  }

  async deleteTemporaryPrefix(prefix: string, scope: DeleteScope): Promise<string[]> {
    const objects = await this.list(prefix);
    return this.deleteTemporary(
      objects.map((o) => o.key),
      scope,
    );
  }
}

let instance: Storage | null = null;
export function storage(): Storage {
  instance ??= new Storage();
  return instance;
}
export function resetStorage(): void {
  instance = null;
}
