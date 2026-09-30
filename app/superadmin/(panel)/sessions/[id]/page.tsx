import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Card, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, whatsappUrl } from "@/lib/format";
import { deleteSession, markDeliverySent, saveSession } from "../actions";
import { SessionForm } from "../SessionForm";

export const metadata = { title: "Session" };

export default async function SessionDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [s, customers, services] = await Promise.all([
    db.shootSession.findUnique({ where: { id }, include: { customer: true, booking: { select: { id: true, reference: true } } } }),
    db.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, instagram: true } }),
    db.service.findMany({ orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!s) notFound();
  const { created } = await searchParams;

  const firstName = s.customer.name.split(" ")[0];
  const deliveryText = s.deliveryLink ? `Hi ${firstName}! Your Ocean X files from ${formatDate(s.date)} are ready: ${s.deliveryLink} — enjoy, and tag us when you post 🌊` : "";
  const wa = s.deliveryLink ? whatsappUrl(s.customer.whatsapp, deliveryText) : null;
  const mail = s.deliveryLink && s.customer.email ? `mailto:${s.customer.email}?subject=${encodeURIComponent("Your Ocean X files are ready")}&body=${encodeURIComponent(deliveryText)}` : null;

  return (
    <>
      <PageHeader
        title={`${s.code} · ${s.customer.name}`}
        subtitle={`${formatDate(s.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${s.time ? ` · ${s.time}` : ""}`}
        back={{ href: "/superadmin/sessions", label: "Sessions" }}
        actions={
          <>
            {s.booking && (
              <Link href={`/superadmin/bookings/${s.booking.id}`} className="rounded-lg border border-slate/30 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-foam">
                Booking {s.booking.reference}
              </Link>
            )}
            <ConfirmButton action={deleteSession.bind(null, s.id)} confirm={`Delete session ${s.code}?`}>
              Delete
            </ConfirmButton>
          </>
        }
      />
      {created && <p className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Session created.</p>}

      {s.deliveryLink && (
        <Card title="Send files to customer" className="mb-6">
          <p className="text-sm text-slate">
            {s.deliveryStatus === "SENT" ? `Marked as sent ${formatDateTime(s.deliverySentAt)}.` : "Send the delivery link, then mark it as sent."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate/25 bg-white px-4 py-2 text-sm font-medium hover:bg-foam">
                Send via WhatsApp
              </a>
            )}
            {mail && (
              <a href={mail} className="rounded-lg border border-slate/25 bg-white px-4 py-2 text-sm font-medium hover:bg-foam">
                Send via email
              </a>
            )}
            <a href={s.deliveryLink} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate/25 bg-white px-4 py-2 text-sm font-medium hover:bg-foam">
              Open link ↗
            </a>
            {s.deliveryStatus !== "SENT" && (
              <form action={markDeliverySent.bind(null, s.id)}>
                <button className="rounded-lg bg-abyss px-4 py-2 text-sm font-semibold text-white hover:bg-ink-3">Mark as sent</button>
              </form>
            )}
          </div>
        </Card>
      )}

      <SessionForm action={saveSession.bind(null, s.id)} values={s} customers={customers} services={services} isNew={false} />
    </>
  );
}
