import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { audit } from "@/lib/audit";
import { now } from "@/lib/clock";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ProcessingError } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { enqueue } from "@/lib/queue";
import { keys } from "@/lib/storage/keys";
import { storage } from "@/lib/storage/s3";
import { watermarkJpeg, type WatermarkSpec } from "@/services/image/watermark";
import { buildZip, planZipParts } from "@/services/zip/package";
import { deliveryState } from "@/lib/auth/client";
import { registerObject } from "@/server/storage-registry";
import type { JobContext } from "../context";

async function stillLive(deliveryId: string) {
  const d = await db.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
  const state = deliveryState(d);
  return { d, live: state === "ok" || state === "preparing" };
}

/**
 * DELIVERY_PREPARE: copy each pinned, published version into the delivery's
 * temporary prefix (server-side copy — byte-identical, no re-encode), copy or
 * watermark previews, write the manifest, then activate.
 */
export async function prepareDelivery(ctx: JobContext): Promise<void> {
  const deliveryId = ctx.job.deliveryId!;
  let { d, live } = await stillLive(deliveryId);
  if (!live) {
    ctx.log(`delivery is ${d.status}; nothing to prepare`);
    return;
  }
  const s = storage();
  const files = await db.deliveryFile.findMany({ where: { deliveryId }, include: { version: true }, orderBy: { sortOrder: "asc" } });
  const watermark = d.watermarkPreviews ? await db.watermark.findFirst({ where: { isDefault: true } }) : null;
  const wdir = join(ctx.workDir, "wm");
  await mkdir(wdir, { recursive: true });

  let i = 0;
  for (const f of files) {
    ({ live } = await stillLive(deliveryId));
    if (!live) return; // revoked/expired mid-way: cleanup will remove partial copies
    if (!f.version.published) throw new ProcessingError(`Version ${f.version.filename} was unpublished before delivery was ready`, f.versionId, false);
    if (!f.copiedAt) {
      await s.copy(f.version.storageKey, f.storageKey, f.mimeType);
      const head = await s.head(f.storageKey);
      if (!head || head.size !== Number(f.version.size)) throw new ProcessingError("Delivery copy is incomplete", f.storageKey);
      await registerObject({ key: f.storageKey, category: "DELIVERY_FILE", size: head.size, deliveryId, projectId: d.projectId, mediaId: f.mediaId, versionId: f.versionId });

      let previewKey: string | null = null;
      let thumbKey: string | null = null;
      const v = f.version;
      if (f.mediaType === "VIDEO") {
        if (v.previewKey) {
          previewKey = keys.deliveryPreview(deliveryId, f.id, "proxy.mp4");
          await s.copy(v.previewKey, previewKey, "video/mp4");
        }
        if (v.thumbKey) {
          thumbKey = keys.deliveryPreview(deliveryId, f.id, "thumb.jpg");
          await s.copy(v.thumbKey, thumbKey, "image/jpeg");
        }
      } else {
        for (const [variant, src] of [["preview.jpg", v.previewKey], ["thumb.jpg", v.thumbKey]] as const) {
          if (!src) continue;
          const dest = keys.deliveryPreview(deliveryId, f.id, variant);
          if (watermark) {
            const marked = await watermarkJpeg(await s.getBuffer(src), watermark as unknown as WatermarkSpec);
            await s.putBuffer(dest, marked, "image/jpeg");
          } else {
            await s.copy(src, dest, "image/jpeg");
          }
          if (variant === "preview.jpg") previewKey = dest;
          else thumbKey = dest;
        }
      }
      for (const k of [previewKey, thumbKey]) {
        if (k) await registerObject({ key: k, category: "DELIVERY_PREVIEW", size: (await s.head(k))?.size ?? 0, deliveryId, projectId: d.projectId });
      }
      await db.deliveryFile.update({ where: { id: f.id }, data: { copiedAt: now(), previewKey, thumbKey } });
    }
    i++;
    await ctx.progress(i / files.length, `Copied ${i}/${files.length}`);
  }

  const manifestKey = keys.deliveryManifest(deliveryId);
  const manifest = JSON.stringify(d.manifest, null, 2);
  await s.putBuffer(manifestKey, manifest, "application/json");
  await registerObject({ key: manifestKey, category: "DELIVERY_MANIFEST", size: Buffer.byteLength(manifest), deliveryId, projectId: d.projectId });

  const activated = await db.delivery.updateMany({ where: { id: deliveryId, status: "PREPARING", expiresAt: { gt: now() } }, data: { status: "ACTIVE" } });
  if (activated.count) await audit({ action: "DELIVERY_READY", actorType: "SYSTEM", projectId: d.projectId, deliveryId, details: { files: files.length } });

  const buildZipFlag = (ctx.job.settings as { buildZip?: boolean } | null)?.buildZip !== false;
  if (buildZipFlag && files.length > 0) {
    const zipJob = await db.processingJob.create({ data: { jobType: "ZIP_PACKAGE", projectId: d.projectId, deliveryId } });
    await enqueue(zipJob);
  }
  d = await db.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
  ctx.log(`delivery ${deliveryId} status ${d.status}`);
}

function zipBaseName(title: string): string {
  return title.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 80) || "OCEANX_Delivery";
}

/** ZIP_PACKAGE: temporary ZIP part(s) of the delivery copies, streamed storage → storage. */
export async function packageDelivery(ctx: JobContext): Promise<void> {
  const deliveryId = ctx.job.deliveryId!;
  const { d, live } = await stillLive(deliveryId);
  if (!live) return;
  const files = await db.deliveryFile.findMany({ where: { deliveryId, copiedAt: { not: null } }, orderBy: { sortOrder: "asc" } });
  const parts = planZipParts(
    files.map((f) => ({ key: f.storageKey, filename: f.filename, size: Number(f.size) })),
    env().ZIP_PART_MAX_BYTES,
  );
  const base = `${zipBaseName(d.title)}_Final`;
  const s = storage();
  for (const [idx, entries] of parts.entries()) {
    const partNumber = idx + 1;
    const filename = parts.length === 1 ? `${base}.zip` : `${base}_Part${partNumber}.zip`;
    const existing = await db.deliveryPackage.findUnique({ where: { deliveryId_partNumber: { deliveryId, partNumber } } });
    if (existing?.status === "READY") continue;
    const id = existing?.id ?? newId();
    const key = keys.deliveryPackage(deliveryId, id);
    await db.deliveryPackage.upsert({
      where: { deliveryId_partNumber: { deliveryId, partNumber } },
      create: { id, deliveryId, partNumber, totalParts: parts.length, filename, storageKey: key, status: "BUILDING", fileCount: entries.length },
      update: { status: "BUILDING", totalParts: parts.length, filename, fileCount: entries.length },
    });
    await registerObject({ key, category: "DELIVERY_PACKAGE", size: 0, deliveryId, projectId: d.projectId });
    await ctx.progress(idx / parts.length, `Building ${filename}`);
    await buildZip(s, entries, key);
    const head = await s.head(key);
    await db.deliveryPackage.update({ where: { id }, data: { status: "READY", size: BigInt(head?.size ?? 0) } });
    await registerObject({ key, category: "DELIVERY_PACKAGE", size: head?.size ?? 0, deliveryId, projectId: d.projectId });
    await audit({ action: "PACKAGE_CREATED", actorType: "SYSTEM", projectId: d.projectId, deliveryId, details: { filename, size: head?.size ?? 0, files: entries.length } });
  }
}
