import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveSession } from "../actions";
import { SessionForm, type SessionValues } from "../SessionForm";

export const metadata = { title: "New session" };

export default async function NewSession({ searchParams }: { searchParams: Promise<{ booking?: string; customer?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [booking, customers, services] = await Promise.all([
    sp.booking ? db.booking.findUnique({ where: { id: sp.booking } }) : null,
    db.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, instagram: true } }),
    db.service.findMany({ orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  // Pre-fill from the booking request when coming from "Create session".
  const values: SessionValues = {
    customerId: booking?.customerId ?? sp.customer ?? "",
    serviceId: booking?.serviceId ?? null,
    locationText: booking?.locationText ?? "",
    date: booking?.preferredDate ?? null,
    time: booking?.preferredTime ?? null,
    people: booking?.people ?? null,
    clips: null,
    price: booking?.price ?? null,
    paymentStatus: booking?.paymentStatus ?? "UNPAID",
    status: "SCHEDULED",
    deliveryStatus: "NOT_READY",
    deliveryLink: null,
    notes: "",
    bookingId: booking?.id ?? null,
  };

  return (
    <>
      <PageHeader
        title="New session"
        subtitle={booking ? `From booking ${booking.reference} — ${booking.fullName}. Saving marks the booking as confirmed.` : undefined}
        back={booking ? { href: `/superadmin/bookings/${booking.id}`, label: `Booking ${booking.reference}` } : { href: "/superadmin/sessions", label: "Sessions" }}
      />
      <SessionForm action={saveSession.bind(null, null)} values={values} customers={customers} services={services} isNew />
    </>
  );
}
