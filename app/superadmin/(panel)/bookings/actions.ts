"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fieldErrors, formToObject, type FormState } from "@/lib/forms";
import { bookingUpdateSchema } from "@/lib/validation";

export async function updateBooking(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = bookingUpdateSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  await db.booking.update({ where: { id }, data: { status: v.status, paymentStatus: v.paymentStatus, price: v.price ?? null, notes: v.notes } });
  revalidatePath("/superadmin", "layout");
  return { ok: true, message: "Booking updated." };
}

export async function setBookingStatus(id: string, status: "CONTACTED" | "CONFIRMED" | "CANCELLED") {
  await requireAdmin();
  await db.booking.update({ where: { id }, data: { status } });
  revalidatePath("/superadmin", "layout");
}

export async function deleteBooking(id: string) {
  await requireAdmin();
  await db.booking.delete({ where: { id } });
  revalidatePath("/superadmin", "layout");
  redirect("/superadmin/bookings");
}
