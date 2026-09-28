import type { Delivery, Prisma } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { now } from "@/lib/clock";
import { decrypt, encrypt, hashPassword, hashToken, randomPassword, randomToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { badRequest, conflict, gone, notFound } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { enqueue, getQueue, QUEUE_NAMES } from "@/lib/queue";
import { keys } from "@/lib/storage/keys";
import { storage } from "@/lib/storage/s3";
import { deliveryState } from "@/lib/auth/client";

export const createDeliverySchema = z.object({
  projectId: z.string().min(1).max(64),
  clientId: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(160).optional(),
  versionIds: z.array(z.string().min(1).max(64)).min(1).max(5000),
  allowFavorites: z.boolean().default(true),
  watermarkPreviews: z.boolean().default(false),
  password: z.string().min(8).max(128).optional(),
  buildZip: z.boolean().default(true),
});
export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;

export interface DeliveryManifest {
  deliveryId: string;
  createdAt: string;
  expiresAt: string;
  files: { fileId: string; mediaId: string; versionId: string; filename: string; label: string; size: number; checksum: string | null }[];
}

export function deliveryTtlMs(): number {
  return env().DELIVERY_TTL_HOURS * 3600 * 1000;
}

export function galleryUrl(token: string): string {
  return `${env().APP_URL.replace(/\/$/, "")}/gallery/${token}`;
}

/**
 * Create a 48-hour private delivery from PUBLISHED versions only. The exact
 * versions are pinned in a manifest; files are copied (server-side) into the
 * delivery's own temporary prefix by the worker.
 */
export async function createDelivery(input: CreateDeliveryInput, adminId: string, opts: { renewedFromId?: string } = {}) {
  const [project, client] = await Promise.all([
    db.project.findUnique({ where: { id: input.projectId } }),
    db.client.findUnique({ where: { id: input.clientId } }),
  ]);
  if (!project) throw notFound("Project not found");
  if (!client) throw notFound("Client not found");

  const ids = [...new Set(input.versionIds)];
  const versions = await db.mediaVersion.findMany({
    where: { id: { in: ids }, projectId: project.id },
    include: { media: { select: { id: true, mediaType: true, status: true } } },
    orderBy: [{ media: { capturedAt: "asc" } }, { media: { filename: "asc" } }],
  });
  if (versions.length !== ids.length) throw badRequest("Some selected versions do not belong to this project");
  const unpublished = versions.filter((v) => !v.published);
  if (unpublished.length) {
    throw badRequest(`Only published versions can be delivered (${unpublished.length} selected version(s) are not published)`);
  }
  if (versions.some((v) => v.media.status !== "READY")) throw badRequest("All files must be fully ingested before delivery");

  const token = randomToken(32);
  const password = input.password ?? randomPassword();
  const createdAt = now();
  const expiresAt = new Date(createdAt.getTime() + deliveryTtlMs());
  const deliveryId = newId();

  const files = versions.map((v, i) => {
    const fileId = newId();
    return {
      id: fileId,
      deliveryId,
      mediaId: v.mediaId,
      versionId: v.id,
      filename: v.filename,
      label: v.label,
      mediaType: v.media.mediaType,
      mimeType: v.mimeType,
      size: v.size,
      checksum: v.checksum,
      width: v.width,
      height: v.height,
      duration: v.duration,
      storageKey: keys.deliveryFile(deliveryId, fileId),
      sortOrder: i,
    };
  });
  const manifest: DeliveryManifest = {
    deliveryId,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    files: files.map((f) => ({
      fileId: f.id,
      mediaId: f.mediaId,
      versionId: f.versionId,
      filename: f.filename,
      label: f.label,
      size: Number(f.size),
      checksum: f.checksum,
    })),
  };

  const job = await db.$transaction(async (tx) => {
    await tx.delivery.create({
      data: {
        id: deliveryId,
        projectId: project.id,
        clientId: client.id,
        title: input.title ?? project.name,
        secureTokenHash: hashToken(token),
        tokenCiphertext: encrypt(token),
        passwordHash: await hashPassword(password),
        passwordCiphertext: encrypt(password),
        status: "PREPARING",
        allowFavorites: input.allowFavorites,
        watermarkPreviews: input.watermarkPreviews,
        manifest: manifest as unknown as Prisma.InputJsonValue,
        createdAt,
        expiresAt,
        createdById: adminId,
        renewedFromId: opts.renewedFromId ?? null,
      },
    });
    await tx.deliveryFile.createMany({ data: files });
    await tx.projectAccess.upsert({
      where: { projectId_clientId: { projectId: project.id, clientId: client.id } },
      create: { projectId: project.id, clientId: client.id },
      update: {},
    });
    await tx.project.updateMany({ where: { id: project.id, status: { in: ["DRAFT", "READY", "PROCESSING"] } }, data: { status: "ACTIVE" } });
    return tx.processingJob.create({
      data: { jobType: "DELIVERY_PREPARE", projectId: project.id, deliveryId, settings: { buildZip: input.buildZip }, createdById: adminId },
    });
  });
  await audit({
    action: opts.renewedFromId ? "DELIVERY_RENEWED" : "DELIVERY_CREATED",
    actorType: "ADMIN",
    actorId: adminId,
    projectId: project.id,
    deliveryId,
    details: { files: files.length, expiresAt: expiresAt.toISOString(), renewedFromId: opts.renewedFromId ?? null },
  });
  await enqueue(job);
  const delivery = await db.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
  return { delivery, link: galleryUrl(token), password };
}

export async function deliverySecrets(id: string) {
  const d = await db.delivery.findUnique({ where: { id } });
  if (!d) throw notFound("Delivery not found");
  if (d.status === "DELETED" || d.status === "REVOKED") throw gone("This delivery is no longer active");
  return { link: galleryUrl(decrypt(d.tokenCiphertext)), password: decrypt(d.passwordCiphertext) };
}

/** Revoke immediately: access is denied on the very next request, then temporary files are deleted. */
export async function revokeDelivery(id: string, adminId: string) {
  const d = await db.delivery.findUnique({ where: { id } });
  if (!d) throw notFound("Delivery not found");
  if (d.status === "DELETED" || d.status === "REVOKED") return d;
  const t = now();
  const updated = await db.$transaction(async (tx) => {
    await tx.session.updateMany({ where: { deliveryId: id, revokedAt: null }, data: { revokedAt: t } });
    return tx.delivery.update({ where: { id }, data: { status: "REVOKED", revokedAt: t } });
  });
  await audit({ action: "DELIVERY_REVOKED", actorType: "ADMIN", actorId: adminId, projectId: d.projectId, deliveryId: id });
  await scheduleCleanup(id);
  return updated;
}

/** New 48-hour delivery re-using the same permanent masters/derivatives — no re-upload. */
export async function renewDelivery(id: string, adminId: string) {
  const d = await db.delivery.findUnique({ where: { id }, include: { files: { include: { version: { select: { id: true, published: true } } } } } });
  if (!d) throw notFound("Delivery not found");
  const versionIds = d.files.filter((f) => f.version.published).map((f) => f.versionId);
  if (versionIds.length === 0) throw conflict("None of this delivery's versions are still published");
  return createDelivery(
    {
      projectId: d.projectId,
      clientId: d.clientId,
      title: d.title,
      versionIds,
      allowFavorites: d.allowFavorites,
      watermarkPreviews: d.watermarkPreviews,
      buildZip: true,
    },
    adminId,
    { renewedFromId: d.id },
  );
}

export async function scheduleCleanup(deliveryId: string) {
  try {
    await getQueue(QUEUE_NAMES.maintenance).add("cleanup-delivery", { deliveryId }, { jobId: `cleanup-${deliveryId}-${Date.now()}` });
  } catch {
    // the scheduled sweep will pick it up; access is already denied server-side
  }
}

/** Display status for dashboards (EXPIRING SOON is derived, never stored). */
export function displayStatus(d: Pick<Delivery, "status" | "expiresAt">, at: Date = now()): string {
  const state = deliveryState(d, at);
  if (d.status === "ACTIVE" && state === "expired") return "EXPIRED";
  if (d.status === "ACTIVE" && d.expiresAt.getTime() - at.getTime() < 6 * 3600 * 1000) return "EXPIRING SOON";
  return d.status;
}

// ---------------------------------------------------------------------------
// client-facing reads — every query is scoped to the authenticated delivery
// ---------------------------------------------------------------------------
export async function clientGallery(delivery: Delivery) {
  const s = storage();
  const ttl = env().PREVIEW_URL_TTL_SECONDS;
  const files = await db.deliveryFile.findMany({
    where: { deliveryId: delivery.id, copiedAt: { not: null }, version: { published: true } },
    orderBy: { sortOrder: "asc" },
    include: { favorites: { select: { id: true } } },
  });
  const packages = await db.deliveryPackage.findMany({ where: { deliveryId: delivery.id, status: "READY" }, orderBy: { partNumber: "asc" } });
  const signed = await Promise.all(
    files.map(async (f) => ({
      id: f.id,
      filename: f.filename,
      label: f.label,
      mediaType: f.mediaType,
      size: Number(f.size),
      width: f.width,
      height: f.height,
      duration: f.duration,
      favorite: f.favorites.length > 0,
      previewUrl: f.previewKey ? await s.presignGet(f.previewKey, { expiresIn: ttl }) : null,
      thumbUrl: f.thumbKey ? await s.presignGet(f.thumbKey, { expiresIn: ttl }) : null,
    })),
  );
  return {
    title: delivery.title,
    expiresAt: delivery.expiresAt.toISOString(),
    serverTime: now().toISOString(),
    allowFavorites: delivery.allowFavorites,
    files: signed,
    packages: packages.map((p) => ({ id: p.id, filename: p.filename, size: Number(p.size), partNumber: p.partNumber, totalParts: p.totalParts, fileCount: p.fileCount })),
  };
}

export async function clientDownload(
  delivery: Delivery,
  target: { fileId?: string; packageId?: string },
  meta: { ipHash: string | null; userAgent: string | null; sessionId: string },
) {
  const s = storage();
  const ttl = env().DOWNLOAD_URL_TTL_SECONDS;
  if (target.fileId) {
    const f = await db.deliveryFile.findFirst({
      where: { id: target.fileId, deliveryId: delivery.id, copiedAt: { not: null }, version: { published: true } },
    });
    if (!f) throw notFound("File not found");
    // Exact stored bytes, exact filename — no resizing, no re-encoding.
    const url = await s.presignGet(f.storageKey, { expiresIn: ttl, downloadFilename: f.filename, contentType: f.mimeType });
    await db.download.create({
      data: { deliveryId: delivery.id, deliveryFileId: f.id, mediaId: f.mediaId, versionId: f.versionId, downloadType: "FILE", label: f.label, ipHash: meta.ipHash, userAgent: meta.userAgent?.slice(0, 300) },
    });
    await audit({ action: "DOWNLOAD", actorType: "CLIENT", actorId: meta.sessionId, deliveryId: delivery.id, projectId: delivery.projectId, mediaId: f.mediaId, details: { fileId: f.id, versionId: f.versionId, filename: f.filename } });
    return { url, filename: f.filename, size: Number(f.size), expiresIn: ttl };
  }
  if (target.packageId) {
    const p = await db.deliveryPackage.findFirst({ where: { id: target.packageId, deliveryId: delivery.id, status: "READY" } });
    if (!p) throw notFound("Package not found");
    const url = await s.presignGet(p.storageKey, { expiresIn: ttl, downloadFilename: p.filename, contentType: "application/zip" });
    await db.download.create({ data: { deliveryId: delivery.id, packageId: p.id, downloadType: "PACKAGE", label: p.filename, ipHash: meta.ipHash, userAgent: meta.userAgent?.slice(0, 300) } });
    await audit({ action: "DOWNLOAD", actorType: "CLIENT", actorId: meta.sessionId, deliveryId: delivery.id, projectId: delivery.projectId, details: { packageId: p.id, filename: p.filename } });
    return { url, filename: p.filename, size: Number(p.size), expiresIn: ttl };
  }
  throw badRequest("Specify a file or package");
}

export async function toggleFavorite(delivery: Delivery, fileId: string, favorite: boolean) {
  if (!delivery.allowFavorites) throw badRequest("Favorites are disabled for this gallery");
  const f = await db.deliveryFile.findFirst({ where: { id: fileId, deliveryId: delivery.id, version: { published: true } } });
  if (!f) throw notFound("File not found");
  if (favorite) {
    await db.favorite.upsert({
      where: { deliveryId_deliveryFileId: { deliveryId: delivery.id, deliveryFileId: f.id } },
      create: { deliveryId: delivery.id, deliveryFileId: f.id, mediaId: f.mediaId },
      update: {},
    });
  } else {
    await db.favorite.deleteMany({ where: { deliveryId: delivery.id, deliveryFileId: f.id } });
  }
  return { fileId: f.id, favorite };
}
