"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export type RemoveState = { status: "idle" } | { status: "error"; error: string } | { status: "sent"; hidden: boolean };

/**
 * "Remove my clip": the clip is taken out of the public gallery straight away
 * (the owner can put it back), and the request is listed for the owner.
 */
export async function requestRemoval(_prev: RemoveState, fd: FormData): Promise<RemoveState> {
  if (fd.get("website")) return { status: "sent", hidden: false };
  const code = String(fd.get("code") ?? "").trim().toUpperCase().slice(0, 20);
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 1000);
  const contact = String(fd.get("contact") ?? "").trim().slice(0, 200);
  if (!/^[A-Z]{2,4}-\d{4}-\d{2,3}$/.test(code)) return { status: "error", error: "Enter the clip code as shown on the clip, e.g. MC-2710-07." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await rateLimit(`remove:${ip}`, 10, 3600))) return { status: "error", error: "Too many requests. Please message us on WhatsApp." };

  const clip = await db.clip.findUnique({ where: { code }, select: { id: true, bookingId: true } });
  await db.removalRequest.create({ data: { clipCode: code, reason, contact, clipId: clip?.id ?? null } });
  let hidden = false;
  if (clip && !clip.bookingId) {
    await db.clip.update({ where: { id: clip.id }, data: { hidden: true } });
    hidden = true;
    revalidatePath("/clips");
  }
  revalidatePath("/superadmin", "layout");
  return { status: "sent", hidden };
}
