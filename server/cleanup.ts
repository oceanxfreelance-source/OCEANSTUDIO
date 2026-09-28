import { audit } from "@/lib/audit";
import { now } from "@/lib/clock";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { assertDeletable, keys } from "@/lib/storage/keys";
import { storage } from "@/lib/storage/s3";

export interface CleanupReport {
  deliveryId: string;
  outcome: "deleted" | "skipped" | "failed" | "locked";
  deletedObjects: number;
  error?: string;
}

/**
 * Expire and clean up one delivery. Safe to run any number of times, from any
 * number of runners (a lease column prevents concurrent work on the same
 * delivery). ONLY objects under deliveries/{id}/ are ever deleted — every key
 * passes assertDeletable(), which rejects masters and all of projects/.
 */
export async function cleanupDelivery(deliveryId: string): Promise<CleanupReport> {
  const t = now();
  const lease = await db.delivery.updateMany({
    where: { id: deliveryId, status: { not: "DELETED" }, OR: [{ cleanupLockedUntil: null }, { cleanupLockedUntil: { lt: t } }] },
    data: { cleanupLockedUntil: new Date(t.getTime() + 10 * 60_000) },
  });
  if (lease.count === 0) {
    const d = await db.delivery.findUnique({ where: { id: deliveryId }, select: { status: true } });
    return { deliveryId, outcome: d?.status === "DELETED" ? "skipped" : "locked", deletedObjects: 0 };
  }

  const d = await db.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
  const expired = t.getTime() >= d.expiresAt.getTime();
  if (!expired && d.status !== "REVOKED" && d.status !== "EXPIRED" && d.status !== "DELETING") {
    await db.delivery.update({ where: { id: d.id }, data: { cleanupLockedUntil: null } });
    return { deliveryId, outcome: "skipped", deletedObjects: 0 };
  }

  try {
    // 1. mark EXPIRED (revoked deliveries keep their REVOKED record until deletion)
    if (expired && (d.status === "ACTIVE" || d.status === "PREPARING" || d.status === "FAILED")) {
      await db.delivery.update({ where: { id: d.id }, data: { status: "EXPIRED", expiredAt: d.expiredAt ?? t } });
      await audit({ action: "DELIVERY_EXPIRED", actorType: "SYSTEM", projectId: d.projectId, deliveryId: d.id, details: { expiresAt: d.expiresAt.toISOString() } });
    }
    // 2. revoke every client session
    await db.session.updateMany({ where: { deliveryId: d.id, revokedAt: null }, data: { revokedAt: t } });
    await db.delivery.update({ where: { id: d.id }, data: { status: "DELETING" } });

    // 3–7. delete registered temporary objects + anything left under the delivery prefix
    const s = storage();
    const prefix = keys.deliveryPrefix(d.id);
    const registered = await db.storageObject.findMany({ where: { deliveryId: d.id, temporary: true, deletedAt: null }, select: { key: true } });
    const listed = await s.list(prefix);
    const toDelete = [...new Set([...registered.map((r) => r.key), ...listed.map((l) => l.key)])];
    for (const k of toDelete) assertDeletable(k, { deliveryId: d.id }); // hard stop before any delete call
    const deleted = await s.deleteTemporary(toDelete, { deliveryId: d.id });
    await db.storageObject.updateMany({ where: { key: { in: deleted } }, data: { deletedAt: t } });
    await db.deliveryPackage.updateMany({ where: { deliveryId: d.id }, data: { status: "DELETED" } });
    const remaining = await s.list(prefix);
    if (remaining.length > 0) throw new Error(`${remaining.length} object(s) still present under ${prefix}`);

    // 8. mark DELETED
    await db.delivery.update({ where: { id: d.id }, data: { status: "DELETED", deletedAt: t, cleanupLockedUntil: null, lastCleanupError: null } });
    await audit({ action: "DELIVERY_DELETED", actorType: "SYSTEM", projectId: d.projectId, deliveryId: d.id, details: { deletedObjects: deleted.length } });
    logger.info({ deliveryId: d.id, deleted: deleted.length }, "delivery cleaned up");
    return { deliveryId, outcome: "deleted", deletedObjects: deleted.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, deliveryId }, "delivery cleanup failed; will retry");
    await db.delivery.update({
      where: { id: d.id },
      data: { cleanupAttempts: { increment: 1 }, lastCleanupError: message.slice(0, 2000), cleanupLockedUntil: null },
    });
    await audit({ action: "DELIVERY_CLEANUP_FAILED", actorType: "SYSTEM", projectId: d.projectId, deliveryId: d.id, details: { error: message.slice(0, 500) } });
    return { deliveryId, outcome: "failed", deletedObjects: 0, error: message };
  }
}

/** Sweep: every delivery that is past expires_at, revoked, or stuck mid-cleanup. */
export async function runDeliveryCleanup(limit = 100): Promise<CleanupReport[]> {
  const t = now();
  const candidates = await db.delivery.findMany({
    where: {
      status: { not: "DELETED" },
      OR: [{ expiresAt: { lte: t } }, { status: { in: ["REVOKED", "EXPIRED", "DELETING"] } }],
    },
    select: { id: true },
    orderBy: { expiresAt: "asc" },
    take: limit,
  });
  const reports: CleanupReport[] = [];
  for (const c of candidates) reports.push(await cleanupDelivery(c.id));
  return reports;
}
