import type { StorageCategory } from "@prisma/client";
import { now } from "@/lib/clock";
import { db } from "@/lib/db";

export async function dashboardStats() {
  const t = now();
  const soon = new Date(t.getTime() + 6 * 3600 * 1000);
  const [totalProjects, activeProjects, processing, queued, failedJobs, activeDeliveries, expiring, recentDownloads, storageTotals] = await Promise.all([
    db.project.count({ where: { status: { not: "ARCHIVED" } } }),
    db.project.count({ where: { status: { in: ["ACTIVE", "PROCESSING"] } } }),
    db.processingJob.count({ where: { status: "PROCESSING" } }),
    db.processingJob.count({ where: { status: "QUEUED" } }),
    db.processingJob.findMany({ where: { status: "FAILED" }, orderBy: { completedAt: "desc" }, take: 8, include: { media: { select: { filename: true } } } }),
    db.delivery.count({ where: { status: "ACTIVE", expiresAt: { gt: t } } }),
    db.delivery.findMany({ where: { status: "ACTIVE", expiresAt: { gt: t, lte: soon } }, include: { client: { select: { name: true } } }, orderBy: { expiresAt: "asc" } }),
    db.download.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { delivery: { select: { title: true } } } }),
    storageUsage(),
  ]);
  return { totalProjects, activeProjects, processing, queued, failedJobs, activeDeliveries, expiring, recentDownloads, storage: storageTotals };
}

export async function storageUsage() {
  const grouped = await db.storageObject.groupBy({ by: ["category"], where: { deletedAt: null }, _sum: { size: true }, _count: true });
  const rawMasters = await db.mediaFile.aggregate({ where: { mediaType: "RAW", checksum: { not: null } }, _sum: { size: true }, _count: true });
  const by = (c: StorageCategory) => grouped.find((g) => g.category === c);
  const bytes = (c: StorageCategory) => Number(by(c)?._sum.size ?? 0);
  const masters = bytes("MASTER");
  const raw = Number(rawMasters._sum.size ?? 0);
  const temporary = bytes("DELIVERY_FILE") + bytes("DELIVERY_PREVIEW") + bytes("DELIVERY_PACKAGE") + bytes("DELIVERY_MANIFEST");
  const rows = {
    masters,
    raw,
    derivatives: bytes("DERIVATIVE"),
    previews: bytes("PREVIEW"),
    temporary,
    processing: bytes("PROCESSING_TEMP"),
  };
  return { ...rows, total: masters + rows.derivatives + rows.previews + temporary + rows.processing, counts: Object.fromEntries(grouped.map((g) => [g.category, g._count])) };
}

export async function downloadAnalytics() {
  const [total, last, byVersion, recent] = await Promise.all([
    db.download.count(),
    db.download.findFirst({ orderBy: { createdAt: "desc" } }),
    db.download.groupBy({ by: ["versionId"], where: { versionId: { not: null }, downloadType: "FILE" }, _count: true, orderBy: { _count: { versionId: "desc" } }, take: 10 }),
    db.download.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { delivery: { select: { id: true, title: true, client: { select: { name: true } } } } } }),
  ]);
  const versions = await db.mediaVersion.findMany({ where: { id: { in: byVersion.map((b) => b.versionId!) } }, select: { id: true, filename: true, label: true, thumbKey: true } });
  return {
    total,
    lastDownloadAt: last?.createdAt ?? null,
    mostDownloaded: byVersion.map((b) => ({ count: b._count, version: versions.find((v) => v.id === b.versionId) ?? null })),
    recent,
  };
}
