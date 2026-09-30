import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Badge, ButtonLink, Card, options, PageHeader, Select, STATUS_TONE, TextArea, TextField } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { BOOKING_STATUS_LABEL, DELIVERY_STATUS_LABEL, PAYMENT_STATUS_LABEL, SESSION_STATUS_LABEL } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, instagramUrl, money, whatsappUrl } from "@/lib/format";
import { deleteBooking, setBookingStatus, updateBooking } from "../actions";

export const metadata = { title: "Booking" };

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const b = await db.booking.findUnique({
    where: { id },
    include: { customer: { include: { _count: { select: { bookings: true, sessions: true } } } }, sessions: { orderBy: { date: "asc" } } },
  });
  if (!b) notFound();

  const firstName = b.fullName.split(" ")[0];
  const wa = whatsappUrl(b.whatsapp, `Hi ${firstName}, this is Ocean X — thanks for your request${b.serviceName ? ` for ${b.serviceName}` : ""}!`);
  const ig = instagramUrl(b.instagram);

  return (
    <>
      <PageHeader
        title={b.fullName}
        subtitle={`${b.reference} · received ${formatDateTime(b.createdAt)}`}
        back={{ href: "/superadmin/bookings", label: "Bookings" }}
        actions={
          <>
            <ButtonLink href={`/superadmin/sessions/new?booking=${b.id}`}>Create session</ButtonLink>
            <ConfirmButton action={deleteBooking.bind(null, b.id)} confirm="Delete this booking request? (Use for spam — for real requests, mark Cancelled instead.)">
              Delete
            </ConfirmButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title="Request" actions={<Badge tone={STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>}>
            <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <Item label="Service" value={b.serviceName || "Not sure yet"} />
              <Item label="Location" value={b.locationText || "Not specified"} />
              <Item label="Preferred date" value={b.preferredDate ? formatDate(b.preferredDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Flexible"} />
              <Item label="Preferred time" value={b.preferredTime || "Any time"} />
              <Item label="Number of people / surfers" value={b.people?.toString() ?? "—"} />
              <Item label="Price" value={money(b.price)} />
            </dl>
            <div className="mt-5 border-t border-slate/10 pt-5">
              <p className="text-xs font-medium uppercase tracking-wider text-slate">Message</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{b.message || "—"}</p>
            </div>
            {b.status === "NEW" && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-slate/10 pt-5">
                <form action={setBookingStatus.bind(null, b.id, "CONTACTED")}>
                  <button className="rounded-lg border border-slate/30 bg-white px-3 py-2 text-sm hover:bg-foam">Mark as contacted</button>
                </form>
                <form action={setBookingStatus.bind(null, b.id, "CONFIRMED")}>
                  <button className="rounded-lg border border-slate/30 bg-white px-3 py-2 text-sm hover:bg-foam">Mark as confirmed</button>
                </form>
              </div>
            )}
          </Card>

          <Card title="Update booking">
            <ActionForm action={updateBooking.bind(null, b.id)} successMessage="Booking updated.">
              <div className="grid gap-5 sm:grid-cols-3">
                <Select label="Status" name="status" defaultValue={b.status} options={options(BOOKING_STATUS_LABEL)} />
                <Select label="Payment" name="paymentStatus" defaultValue={b.paymentStatus} options={options(PAYMENT_STATUS_LABEL)} />
                <TextField label="Price (USD)" name="price" inputMode="decimal" defaultValue={b.price?.toString() ?? ""} />
              </div>
              <TextArea label="Private notes" name="notes" rows={4} defaultValue={b.notes} className="mt-5" hint="Only visible to admins." />
              <SubmitButton className="mt-5">Save</SubmitButton>
            </ActionForm>
          </Card>

          <Card title="Sessions from this booking">
            {b.sessions.length === 0 ? (
              <p className="text-sm text-slate">
                None yet. <Link href={`/superadmin/sessions/new?booking=${b.id}`} className="text-sea-deep underline">Create a session</Link> once the booking is confirmed.
              </p>
            ) : (
              <ul className="divide-y divide-slate/10">
                {b.sessions.map((s) => (
                  <li key={s.id}>
                    <Link href={`/superadmin/sessions/${s.id}`} className="flex items-center justify-between py-3 text-sm hover:bg-foam/40">
                      <span>
                        <span className="font-medium">{s.code}</span> · {formatDate(s.date)}
                        {s.time ? ` · ${s.time}` : ""}
                      </span>
                      <span className="flex gap-1">
                        <Badge tone={STATUS_TONE[s.status]}>{SESSION_STATUS_LABEL[s.status]}</Badge>
                        <Badge tone={STATUS_TONE[s.deliveryStatus]}>{DELIVERY_STATUS_LABEL[s.deliveryStatus]}</Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Contact">
            <dl className="space-y-3 text-sm">
              <Item label="Instagram" value={b.instagram ? `@${b.instagram}` : "—"} />
              <Item label="Email" value={b.email ?? "—"} />
              <Item label="WhatsApp" value={b.whatsapp ?? "—"} />
            </dl>
            <div className="mt-5 flex flex-col gap-2">
              {wa && <ContactLink href={wa}>Reply on WhatsApp</ContactLink>}
              {ig && <ContactLink href={ig}>Open Instagram profile</ContactLink>}
              {b.email && <ContactLink href={`mailto:${b.email}?subject=${encodeURIComponent("Your Ocean X session request")}`}>Reply by email</ContactLink>}
            </div>
          </Card>
          <Card title="Customer">
            <Link href={`/superadmin/customers/${b.customer.id}`} className="font-medium hover:underline">
              {b.customer.name}
            </Link>
            <p className="mt-1 text-sm text-slate">
              {b.customer._count.bookings} booking{b.customer._count.bookings === 1 ? "" : "s"} · {b.customer._count.sessions} session{b.customer._count.sessions === 1 ? "" : "s"}
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-slate">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}

function ContactLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate/25 bg-white px-3 py-2 text-center text-sm font-medium hover:bg-foam">
      {children}
    </a>
  );
}
