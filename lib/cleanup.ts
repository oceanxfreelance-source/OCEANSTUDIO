import "server-only";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { getShopConfig } from "./shop";
import { deletePrivate, deletePublic, storageReady } from "./storage";

/**
 * Keeps storage small: clips are deleted (original + preview) once they're
 * older than the "keep clips" time — unless someone still needs them:
 *  - an order is waiting for payment (kept up to the download period), or
 *    a paid order can still download them;
 *  - they belong to a booking that isn't finished, or whose downloads are open.
 * Delivered reels/files go once their download period has ended.
 * Runs daily (Vercel Cron) and also when the owner opens the clip pages.
 */
export async function cleanupOldFiles(now = new Date()): Promise<{ clips: number; files: number }> {
  if (!storageReady()) return { clips: 0, files: 0 };
  const cfg = await getShopConfig();
  const cutoff = new Date(now.getTime() - cfg.keepHours * 3600_000);
  const waitingSince = new Date(now.getTime() - cfg.downloadDays * 86400_000);

  const neededByOrder: Prisma.OrderWhereInput = {
    OR: [
      { status: "AWAITING_PAYMENT", createdAt: { gt: waitingSince } },
      { status: { in: ["PAID", "DELIVERED"] }, OR: [{ downloadsUntil: null }, { downloadsUntil: { gt: now } }] },
    ],
  };
  const old = await db.clip.findMany({
    where: {
      createdAt: { lt: cutoff },
      orderItems: { none: { session: { order: neededByOrder } } },
      OR: [
        { bookingId: null },
        { booking: { status: { in: ["COMPLETED", "CANCELLED", "DECLINED"] }, OR: [{ downloadsUntil: null }, { downloadsUntil: { lt: now } }] } },
        { booking: { downloadsUntil: { lt: now } } },
      ],
    },
    select: { id: true, originalKey: true, previewUrl: true, posterUrl: true },
    take: 500,
  });
  for (const c of old) {
    await Promise.all([deletePrivate(c.originalKey), deletePublic(c.previewUrl), deletePublic(c.posterUrl)]);
    await db.clip.delete({ where: { id: c.id } }).catch(() => undefined);
  }

  const files = await db.deliveryFile.findMany({
    where: {
      createdAt: { lt: cutoff },
      OR: [{ order: { downloadsUntil: { lt: now } } }, { booking: { downloadsUntil: { lt: now } } }],
    },
    select: { id: true, key: true },
    take: 200,
  });
  for (const f of files) {
    await deletePrivate(f.key);
    await db.deliveryFile.delete({ where: { id: f.id } }).catch(() => undefined);
  }

  if (old.length) revalidatePath("/clips");
  return { clips: old.length, files: files.length };
}
