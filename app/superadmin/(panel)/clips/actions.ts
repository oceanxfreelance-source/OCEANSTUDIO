"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { DaySlot } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { NO_SPOT_CODE, nextClipCode, parseDay } from "@/lib/clips";
import { db } from "@/lib/db";
import { deletePrivate, deletePublic } from "@/lib/storage";

const SLOT = z.enum(["MORNING", "MIDDAY", "AFTERNOON"]);

const newClip = z.object({
  key: z.string().regex(/^clips\/[a-zA-Z0-9/_.-]{1,300}$/),
  name: z.string().max(200).default(""),
  size: z.number().int().min(0).max(2_000_000_000),
  date: z.string(),
  slot: SLOT,
  locationId: z.string().max(40).nullable(),
  description: z.string().trim().max(200).default(""),
  bookingId: z.string().max(40).nullable(),
});

/** Record an uploaded original as a clip with its code. Preview is made next. */
export async function createClip(input: z.input<typeof newClip>): Promise<{ id: string; code: string } | { error: string }> {
  await requireAdmin();
  const p = newClip.safeParse(input);
  const date = p.success ? parseDay(p.data.date) : null;
  if (!p.success || !date) return { error: "Missing date, session or file." };
  const v = p.data;
  const [spot, booking] = await Promise.all([
    v.locationId ? db.location.findUnique({ where: { id: v.locationId }, select: { id: true, code: true } }) : null,
    v.bookingId ? db.booking.findUnique({ where: { id: v.bookingId }, select: { id: true, status: true } }) : null,
  ]);
  const clip = await db.$transaction(async (tx) => {
    const code = await nextClipCode(tx, spot?.code ?? NO_SPOT_CODE, date);
    return tx.clip.create({
      data: { code, date, slot: v.slot as DaySlot, locationId: spot?.id ?? null, description: v.description, originalKey: v.key, originalName: v.name, originalSize: v.size, bookingId: booking?.id ?? null },
    });
  });
  if (booking && ["NEW", "CONTACTED", "CONFIRMED"].includes(booking.status)) {
    await db.booking.update({ where: { id: booking.id }, data: { status: "FILMED" } });
  }
  revalidatePath("/superadmin/clips");
  return { id: clip.id, code: clip.code };
}

const clipEdit = z.object({
  description: z.string().trim().max(200).optional(),
  bookingId: z.string().max(40).nullable().optional(),
  hidden: z.boolean().optional(),
});

export async function updateClip(id: string, input: z.input<typeof clipEdit>): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const p = clipEdit.safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid change" };
  const data = p.data;
  if (data.bookingId) {
    const b = await db.booking.findUnique({ where: { id: data.bookingId }, select: { id: true } });
    if (!b) return { ok: false, error: "Booking not found" };
  }
  await db.clip.update({ where: { id }, data });
  revalidatePath("/superadmin/clips");
  revalidatePath("/clips");
  return { ok: true };
}

export async function toggleClipHidden(id: string) {
  await requireAdmin();
  const c = await db.clip.findUniqueOrThrow({ where: { id }, select: { hidden: true } });
  await db.clip.update({ where: { id }, data: { hidden: !c.hidden } });
  revalidatePath("/superadmin/clips");
  revalidatePath("/clips");
}

/** Delete a clip and its files — unless someone has bought it (then hide it instead). */
export async function deleteClip(id: string): Promise<{ error?: string } | void> {
  await requireAdmin();
  const sold = await db.orderItem.count({ where: { clipId: id, session: { order: { status: { not: "CANCELLED" } } } } });
  if (sold) return { error: "This clip is in an order, so it can't be deleted. Hide it instead." };
  const clip = await db.clip.delete({ where: { id } });
  await Promise.all([deletePrivate(clip.originalKey), deletePublic(clip.previewUrl), deletePublic(clip.posterUrl)]);
  revalidatePath("/clips");
  redirect("/superadmin/clips");
}
