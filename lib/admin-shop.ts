"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "./auth";
import { db } from "./db";

/** Attach an uploaded private file (e.g. the edited reel) to an order or booking. */
export async function addDeliveryFile(target: { orderId?: string; bookingId?: string }, file: { key: string; name: string; size: number }) {
  await requireAdmin();
  const f = z.object({ key: z.string().regex(/^files\/[a-zA-Z0-9/_.-]{1,300}$/), name: z.string().trim().min(1).max(120), size: z.number().int().min(0) }).parse(file);
  if (!target.orderId && !target.bookingId) throw new Error("No target");
  await db.deliveryFile.create({ data: { ...f, orderId: target.orderId ?? null, bookingId: target.orderId ? null : (target.bookingId ?? null) } });
  revalidatePath("/superadmin", "layout");
}
