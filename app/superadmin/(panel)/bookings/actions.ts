"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { BookingStatus, DaySlot, PaymentStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { hasRoom } from "@/lib/availability";
import { parseDay } from "@/lib/clips";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/forms";
import { getShopConfig } from "@/lib/shop";
import { SLOT_LABEL } from "@/lib/shop-rules";

function refresh(id?: string) {
  revalidatePath("/superadmin", "layout");
  revalidatePath("/book");
  if (id) revalidatePath(`/superadmin/bookings/${id}`);
}

/** Opening downloads needs: clips ready + fully paid. Sets the expiry date then. */
async function downloadsUntilFor(status: BookingStatus, payment: PaymentStatus, current: Date | null): Promise<Date | null> {
  if ((status === "READY" || status === "COMPLETED") && payment === "PAID") {
    if (current && current > new Date()) return current;
    const cfg = await getShopConfig();
    return new Date(Date.now() + cfg.downloadDays * 86400_000);
  }
  return current;
}

export async function setBookingStatus(id: string, status: BookingStatus) {
  await requireAdmin();
  const b = await db.booking.findUniqueOrThrow({ where: { id }, select: { paymentStatus: true, downloadsUntil: true, confirmedAt: true } });
  await db.booking.update({
    where: { id },
    data: {
      status,
      confirmedAt: status === "CONFIRMED" && !b.confirmedAt ? new Date() : b.confirmedAt,
      downloadsUntil: await downloadsUntilFor(status, b.paymentStatus, b.downloadsUntil),
    },
  });
  refresh(id);
}

export async function setBookingPayment(id: string, paymentStatus: PaymentStatus) {
  await requireAdmin();
  const b = await db.booking.findUniqueOrThrow({ where: { id }, select: { status: true, downloadsUntil: true } });
  await db.booking.update({ where: { id }, data: { paymentStatus, downloadsUntil: await downloadsUntilFor(b.status, paymentStatus, b.downloadsUntil) } });
  refresh(id);
}

/** Give the surfer another N days to download. */
export async function reopenBookingDownloads(id: string) {
  await requireAdmin();
  const cfg = await getShopConfig();
  await db.booking.update({ where: { id }, data: { downloadsUntil: new Date(Date.now() + cfg.downloadDays * 86400_000) } });
  refresh(id);
}

const move = z.object({ date: z.string(), slot: z.enum(["MORNING", "MIDDAY", "AFTERNOON"]), note: z.string().trim().max(300).default(""), force: z.string().optional() });

/** Move a booking (waves/wind changed). The surfer sees the change and the note on their page. */
export async function moveBooking(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const p = move.safeParse(Object.fromEntries(fd));
  const date = p.success ? parseDay(p.data.date) : null;
  if (!p.success || !date) return { error: "Choose a date and session." };
  const cfg = await getShopConfig();
  if (!p.data.force && !(await hasRoom(cfg, p.data.date, p.data.slot as DaySlot, id))) {
    return { error: `The ${SLOT_LABEL[p.data.slot].toLowerCase()} session that day is full. Tick “Move anyway” to overbook.` };
  }
  const when = `${date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}, ${SLOT_LABEL[p.data.slot].toLowerCase()} session`;
  await db.booking.update({
    where: { id },
    data: { preferredDate: date, slot: p.data.slot, changeNote: `Your session has moved to ${when}.${p.data.note ? ` ${p.data.note}` : ""}` },
  });
  refresh(id);
  return { ok: true, message: "Moved. The surfer sees the new time on their booking page." };
}

export async function saveBookingNotes(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  await db.booking.update({ where: { id }, data: { notes: String(fd.get("notes") ?? "").slice(0, 5000) } });
  refresh(id);
  return { ok: true, message: "Saved." };
}

/** Availability: close a session or change how many bookings it takes. */
export async function saveAvailability(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const rows: { date: Date; slot: DaySlot; closed: boolean; maxBookings: number | null }[] = [];
  for (const [k, v] of fd.entries()) {
    const m = k.match(/^max:(\d{4}-\d{2}-\d{2}):(MORNING|MIDDAY|AFTERNOON)$/);
    if (!m) continue;
    const date = parseDay(m[1]);
    if (!date) continue;
    const raw = String(v).trim();
    const n = raw === "" ? null : Math.max(0, Math.min(50, Math.round(Number(raw))));
    rows.push({ date, slot: m[2] as DaySlot, closed: fd.get(`closed:${m[1]}:${m[2]}`) === "on", maxBookings: Number.isFinite(n) ? n : null });
  }
  await db.$transaction(
    rows.map((r) =>
      r.closed || r.maxBookings !== null
        ? db.availability.upsert({ where: { date_slot: { date: r.date, slot: r.slot } }, create: r, update: { closed: r.closed, maxBookings: r.maxBookings } })
        : db.availability.deleteMany({ where: { date: r.date, slot: r.slot } }),
    ),
  );
  refresh();
  return { ok: true, message: "Availability saved." };
}
