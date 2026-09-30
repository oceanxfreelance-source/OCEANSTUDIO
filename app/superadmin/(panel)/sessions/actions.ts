"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { nextReference } from "@/lib/counters";
import { db } from "@/lib/db";
import { fieldErrors, formToObject, type FormState } from "@/lib/forms";
import { sessionSchema } from "@/lib/validation";

/** Create (id = null) or update a shoot session, keeping its booking in sync. */
export async function saveSession(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = sessionSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;

  const [customer, service, booking, existing] = await Promise.all([
    db.customer.findUnique({ where: { id: v.customerId } }),
    v.serviceId ? db.service.findUnique({ where: { id: v.serviceId } }) : null,
    v.bookingId ? db.booking.findUnique({ where: { id: v.bookingId } }) : null,
    id ? db.shootSession.findUnique({ where: { id } }) : null,
  ]);
  if (!customer) return { error: "Choose a customer.", fieldErrors: { customerId: "Choose a customer" } };
  if (id && !existing) return { error: "This session no longer exists." };

  const data = {
    customerId: customer.id,
    serviceId: service?.id ?? null,
    serviceName: service?.name ?? existing?.serviceName ?? "",
    locationText: v.locationText,
    date: v.date,
    time: v.time ?? null,
    people: v.people ?? null,
    clips: v.clips ?? null,
    price: v.price ?? null,
    paymentStatus: v.paymentStatus,
    status: v.status,
    deliveryStatus: v.deliveryStatus,
    deliveryLink: v.deliveryLink ?? null,
    deliverySentAt: v.deliveryStatus === "SENT" ? (existing?.deliverySentAt ?? new Date()) : null,
    notes: v.notes,
  };

  const saved = await db.$transaction(async (tx) => {
    const s = id
      ? await tx.shootSession.update({ where: { id }, data })
      : await tx.shootSession.create({ data: { ...data, bookingId: booking?.id ?? null, code: await nextReference(tx, "session", "OX-S") } });
    // Keep the related booking's status in step with the session.
    const bookingId = s.bookingId;
    if (bookingId) {
      const target = s.status === "COMPLETED" ? "COMPLETED" : s.status === "SCHEDULED" ? "CONFIRMED" : null;
      if (target) await tx.booking.updateMany({ where: { id: bookingId, status: { in: target === "COMPLETED" ? ["NEW", "CONTACTED", "CONFIRMED"] : ["NEW", "CONTACTED"] } }, data: { status: target } });
    }
    return s;
  });

  revalidatePath("/superadmin", "layout");
  if (!id) redirect(`/superadmin/sessions/${saved.id}?created=1`);
  return { ok: true, message: "Session saved." };
}

/** One-click: mark the delivery link as sent to the customer. */
export async function markDeliverySent(id: string) {
  await requireAdmin();
  const s = await db.shootSession.findUniqueOrThrow({ where: { id } });
  if (!s.deliveryLink) return;
  await db.shootSession.update({ where: { id }, data: { deliveryStatus: "SENT", deliverySentAt: new Date() } });
  revalidatePath("/superadmin", "layout");
}

export async function deleteSession(id: string) {
  await requireAdmin();
  await db.shootSession.delete({ where: { id } });
  revalidatePath("/superadmin", "layout");
  redirect("/superadmin/sessions");
}
