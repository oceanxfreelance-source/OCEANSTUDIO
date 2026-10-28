import "server-only";
import type { DaySlot } from "@prisma/client";
import { ACTIVE_BOOKING } from "./bookings";
import { dayString, parseDay, todayMaldives } from "./clips";
import { db } from "./db";
import type { ShopConfig } from "./shop";
import { SLOTS } from "./shop-rules";

export type SlotState = { max: number; booked: number; left: number; closed: boolean };
export type DayAvailability = { date: string; slots: Record<DaySlot, SlotState> };

function addDays(day: string, n: number): string {
  return dayString(new Date(parseDay(day)!.getTime() + n * 86400_000));
}

/** First bookable day: tomorrow (Maldives time). */
export function firstBookableDay(): string {
  return addDays(todayMaldives(), 1);
}

/** Open places per session for `days` days from `from` (inclusive). */
export async function getAvailability(cfg: ShopConfig, from: string, days: number, excludeBookingId?: string): Promise<DayAvailability[]> {
  const start = parseDay(from)!;
  const end = new Date(start.getTime() + days * 86400_000);
  const [overrides, counts] = await Promise.all([
    db.availability.findMany({ where: { date: { gte: start, lt: end } } }),
    db.booking.groupBy({
      by: ["preferredDate", "slot"],
      where: { token: { not: null }, preferredDate: { gte: start, lt: end }, status: { in: ACTIVE_BOOKING }, ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}) },
      _count: { _all: true },
    }),
  ]);
  const out: DayAvailability[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const slots = {} as Record<DaySlot, SlotState>;
    for (const slot of SLOTS) {
      const o = overrides.find((r) => dayString(r.date) === date && r.slot === slot);
      const max = o?.maxBookings ?? cfg.maxPerSlot;
      const booked = counts.find((c) => c.preferredDate && dayString(c.preferredDate) === date && c.slot === slot)?._count._all ?? 0;
      const closed = !!o?.closed || max <= 0;
      slots[slot] = { max, booked, left: closed ? 0 : Math.max(0, max - booked), closed };
    }
    out.push({ date, slots });
  }
  return out;
}

/** Is there room in this session (optionally ignoring one booking being moved)? */
export async function hasRoom(cfg: ShopConfig, date: string, slot: DaySlot, excludeBookingId?: string): Promise<boolean> {
  const [day] = await getAvailability(cfg, date, 1, excludeBookingId);
  return !!day && day.slots[slot].left > 0;
}
