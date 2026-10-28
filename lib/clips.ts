import "server-only";
import type { Prisma } from "@prisma/client";

/** Clip code <SPOT>-<DDMM>-<NN>, e.g. MC-2710-07, numbered per spot and day. */
export async function nextClipCode(tx: Prisma.TransactionClient, spotCode: string, date: Date): Promise<string> {
  const iso = date.toISOString().slice(0, 10);
  const ddmm = iso.slice(8, 10) + iso.slice(5, 7);
  for (let tries = 0; tries < 200; tries++) {
    const c = await tx.counter.upsert({ where: { name: `clip:${spotCode}:${iso}` }, create: { name: `clip:${spotCode}:${iso}`, value: 1 }, update: { value: { increment: 1 } } });
    const code = `${spotCode}-${ddmm}-${String(c.value).padStart(2, "0")}`;
    // Same day in an earlier year may already own this code.
    if (!(await tx.clip.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new Error("Could not number this clip");
}

/** Spot code for clips without a surf spot. */
export const NO_SPOT_CODE = "OX";

/** Parse YYYY-MM-DD into a UTC date (DB "date" columns). */
export function parseDay(v: string | null | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today in the Maldives (UTC+5), as YYYY-MM-DD. */
export function todayMaldives(): string {
  return new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
}
