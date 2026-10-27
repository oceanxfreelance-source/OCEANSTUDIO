import "server-only";
import { cache } from "react";
import type { DaySlot, Prisma } from "@prisma/client";
import { db } from "./db";
import { dayString } from "./clips";

/** Clips anyone can find and buy: preview ready, not hidden, not booked. */
export const GALLERY: Prisma.ClipWhereInput = { status: "READY", hidden: false, bookingId: null };

export const PAGE_SIZE = 48;

export const getShopSpots = cache(() =>
  db.location.findMany({ where: { code: { not: null }, published: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, code: true, slug: true } }),
);

/** Days that have gallery clips (newest first), with counts. */
export const getGalleryDays = cache(async () => {
  const rows = await db.clip.groupBy({ by: ["date"], where: GALLERY, _count: { _all: true }, orderBy: { date: "desc" }, take: 45 });
  return rows.map((r) => ({ date: dayString(r.date), count: r._count._all }));
});

export type GalleryFilter = { date?: Date | null; spotId?: string | null; slot?: DaySlot | null; q?: string; page?: number };

export async function getGalleryClips(f: GalleryFilter) {
  const words = (f.q ?? "").toLowerCase().split(/\s+/).filter((w) => w.length > 1).slice(0, 5);
  const where: Prisma.ClipWhereInput = {
    ...GALLERY,
    ...(f.date ? { date: f.date } : {}),
    ...(f.spotId ? { locationId: f.spotId } : {}),
    ...(f.slot ? { slot: f.slot } : {}),
    ...(words.length ? { AND: words.map((w) => ({ OR: [{ description: { contains: w, mode: "insensitive" as const } }, { code: { contains: w, mode: "insensitive" as const } }] })) } : {}),
  };
  const page = Math.max(1, f.page ?? 1);
  const [clips, total] = await Promise.all([
    db.clip.findMany({
      where,
      orderBy: [{ date: "desc" }, { slot: "asc" }, { code: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, code: true, date: true, slot: true, description: true, seconds: true, previewUrl: true, posterUrl: true, location: { select: { id: true, name: true, code: true } } },
    }),
    db.clip.count({ where }),
  ]);
  return { clips, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type GalleryClip = Awaited<ReturnType<typeof getGalleryClips>>["clips"][number];

/** Newest gallery clips, for the home page strip. */
export const getLatestClips = cache((take = 10) =>
  db.clip.findMany({
    where: GALLERY,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
    select: { id: true, code: true, date: true, slot: true, posterUrl: true, location: { select: { name: true } } },
  }),
);
