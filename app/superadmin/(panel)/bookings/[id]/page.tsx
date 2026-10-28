import Link from "next/link";
import { PAYMENT_LABEL } from "@/lib/shop-rules";
import { notFound } from "next/navigation";
import type { BookingStatus, PaymentStatus } from "@prisma/client";
import { DeliveryFileUpload } from "@/components/admin/DeliveryFileUpload";
import { Badge, Card, PageHeader } from "@/components/admin/ui";
import { cx } from "@/components/ui/cx";
import { requireAdmin } from "@/lib/auth";
import { BOOKING_STATUS_LABEL, BOOKING_TONE, PAY_LABEL } from "@/lib/bookings";
import { dayString } from "@/lib/clips";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, money, toNumber, whatsappUrl } from "@/lib/format";
import { BOOKING_PACKAGE_LABEL, SLOT_LABEL } from "@/lib/shop-rules";
import { siteUrl } from "@/lib/site";
import { storageDriver, storageReady } from "@/lib/storage";
import { reopenBookingDownloads, setBookingPayment, setBookingStatus } from "../actions";
import { MoveForm, NotesForm } from "./BookingForms";

export const metadata = { title: "Booking" };

const NEXT: Partial<Record<BookingStatus, { to: BookingStatus; label: string }[]>> = {
  NEW: [{ to: "CONFIRMED", label: "Confirm" }, { to: "DECLINED", label: "Decline" }],
  CONTACTED: [{ to: "CONFIRMED", label: "Confirm" }, { to: "DECLINED", label: "Decline" }],
  CONFIRMED: [{ to: "FILMED", label: "Mark filmed" }, { to: "CANCELLED", label: "Cancel" }],
  FILMED: [{ to: "READY", label: "Clips ready — show them" }],
  READY: [{ to: "COMPLETED", label: "Mark delivered" }],
  DECLINED: [{ to: "NEW", label: "Reopen" }],
  CANCELLED: [{ to: "NEW", label: "Reopen" }],
};

function Btn({ action, children, tone = "secondary" }: { action: () => Promise<void>; children: React.ReactNode; tone?: "primary" | "secondary" | "danger" }) {
  return (
    <form action={action}>
      <button
        className={cx(
          "rounded-lg px-4 py-2.5 text-sm font-semibold",
          tone === "primary" ? "bg-abyss text-white" : tone === "danger" ? "border border-red-200 bg-white text-red-700" : "border border-slate/30 bg-white hover:bg-foam",
        )}
      >
        {children}
      </button>
    </form>
  );
}

export default async function BookingAdmin({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const b = await db.booking.findUnique({
    where: { id },
    include: {
      slips: { orderBy: { createdAt: "desc" } },
      clips: { orderBy: { code: "asc" }, select: { id: true, code: true, posterUrl: true, status: true } },
      files: true,
      customer: { select: { id: true, name: true } },
    },
  });
  if (!b || !b.token) notFound();
  const link = `${siteUrl()}/booking/${b.token}`;
  const first = b.fullName.split(" ")[0];
  const price = toNumber(b.price) ?? 0;
  const deposit = toNumber(b.deposit) ?? 0;
  const waMsg =
    b.status === "READY"
      ? `Hi ${first}! Your Ocean X clips are ready 🌊 ${link}`
      : b.status === "CONFIRMED"
        ? `Hi ${first}! Your Ocean X session is confirmed for ${b.preferredDate ? formatDate(b.preferredDate, { weekday: "long", day: "numeric", month: "long" }) : ""} (${b.slot ? SLOT_LABEL[b.slot].toLowerCase() : ""}). Details: ${link}`
        : `Hi ${first}, it's Ocean X about your booking ${b.reference}: ${link}`;
  const wa = whatsappUrl(b.whatsapp, waMsg);
  const payNext: { to: PaymentStatus; label: string }[] = b.paymentStatus === "UNPAID" ? [{ to: "DEPOSIT", label: `Deposit received (${money(deposit)})` }, { to: "PAID", label: "Paid in full" }] : b.paymentStatus === "DEPOSIT" ? [{ to: "PAID", label: `Balance received (${money(price - deposit)})` }] : [{ to: "UNPAID", label: "Mark unpaid" }];

  return (
    <>
      <PageHeader
        title={b.fullName}
        subtitle={`${b.reference} · booked ${formatDateTime(b.createdAt)}`}
        back={{ href: "/superadmin/bookings", label: "Bookings" }}
        actions={
          <a href={link} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate/30 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-foam">
            Surfer&apos;s page ↗
          </a>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title="Status">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={BOOKING_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
              <Badge tone={PAY_LABEL[b.paymentStatus]![1]}>{PAY_LABEL[b.paymentStatus]![0]}</Badge>
              {b.downloadsUntil && <span className="text-xs text-slate">Downloads until {formatDate(b.downloadsUntil)}</span>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(NEXT[b.status] ?? []).map((n, i) => (
                <Btn key={n.to} action={setBookingStatus.bind(null, b.id, n.to)} tone={i === 0 && !["DECLINED", "CANCELLED"].includes(n.to) ? "primary" : n.to === "DECLINED" || n.to === "CANCELLED" ? "danger" : "secondary"}>
                  {n.label}
                </Btn>
              ))}
              {payNext.map((p) => (
                <Btn key={p.to} action={setBookingPayment.bind(null, b.id, p.to)}>
                  {p.label}
                </Btn>
              ))}
              {(b.status === "READY" || b.status === "COMPLETED") && b.paymentStatus === "PAID" && (
                <Btn action={reopenBookingDownloads.bind(null, b.id)}>Reopen downloads</Btn>
              )}
            </div>
            {b.status === "READY" && b.paymentStatus !== "PAID" && <p className="mt-3 text-xs text-slate">The surfer sees watermarked previews now; downloads open when you mark it paid in full.</p>}
          </Card>

          <Card title={`Clips (${b.clips.length})`} actions={<Link href={`/superadmin/clips/upload?booking=${b.id}`} className="text-sm text-gold-deep underline">+ Upload clips for this booking</Link>}>
            {b.clips.length === 0 ? (
              <p className="text-sm text-slate">No clips yet. After filming, upload them here — they go only to this surfer.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {b.clips.map((c) => (
                  <li key={c.id}>
                    <Link href={`/superadmin/clips/${c.id}`} className="block">
                      <span className="block aspect-[4/5] overflow-hidden rounded bg-ink">
                        {c.posterUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                        )}
                      </span>
                      <span className="mt-1 block font-mono text-[11px]">{c.code}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 border-t border-slate/10 pt-4">
              <p className="mb-2 text-sm font-medium">Edited reel / extra files</p>
              {b.files.length > 0 && (
                <ul className="mb-3 space-y-1 text-sm">
                  {b.files.map((f) => (
                    <li key={f.id}>📎 {f.name}</li>
                  ))}
                </ul>
              )}
              {storageReady() && <DeliveryFileUpload bookingId={b.id} driver={storageDriver()} />}
            </div>
          </Card>

          <Card title="Move to another session">
            <MoveForm id={b.id} date={b.preferredDate ? dayString(b.preferredDate) : ""} slot={b.slot ?? "MORNING"} />
            {b.changeNote && <p className="mt-3 text-xs text-slate">Shown to the surfer: “{b.changeNote}”</p>}
          </Card>

          <Card title="Private notes">
            <NotesForm id={b.id} notes={b.notes} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Session">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-slate">When</dt>
                <dd className="font-medium">
                  {b.preferredDate ? formatDate(b.preferredDate, { weekday: "long", day: "numeric", month: "long" }) : "—"} · {b.slot ? SLOT_LABEL[b.slot] : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate">Where</dt>
                <dd>{b.locationText}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate">Package</dt>
                <dd>
                  {b.package ? BOOKING_PACKAGE_LABEL[b.package] : b.serviceName} · {b.people ?? 1} surfer(s)
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate">How to spot them</dt>
                <dd className="whitespace-pre-line">{b.recognition || "—"}</dd>
              </div>
              {b.message && (
                <div>
                  <dt className="text-xs text-slate">Note</dt>
                  <dd className="whitespace-pre-line">{b.message}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-slate">Price</dt>
                <dd>
                  {money(price)} · deposit {money(deposit)} · {b.paymentMethod ? PAYMENT_LABEL[b.paymentMethod] : "—"}
                </dd>
              </div>
              {b.partnerRef && (
                <div>
                  <dt className="text-xs text-slate">Referred by</dt>
                  <dd>{b.partnerRef}</dd>
                </div>
              )}
            </dl>
          </Card>
          <Card title="Contact">
            <p className="text-sm">{b.whatsapp ?? "—"}</p>
            <p className="text-sm">{b.email ?? ""}</p>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-3 block rounded-lg bg-[#25D366] px-4 py-2.5 text-center text-sm font-semibold text-black">
                Message on WhatsApp
              </a>
            )}
            <p className="mt-3 text-xs text-slate">
              Customer record: <Link href={`/superadmin/customers/${b.customer.id}`} className="underline">{b.customer.name}</Link>
            </p>
          </Card>
          <Card title={`Payment slips (${b.slips.length})`}>
            {b.slips.length === 0 ? (
              <p className="text-sm text-slate">None uploaded.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {b.slips.map((s) => (
                  <li key={s.id}>
                    <a href={`/api/admin/slips/${s.id}`} target="_blank" rel="noopener noreferrer" className="text-gold-deep underline">
                      {s.mimeType === "application/pdf" ? "PDF slip" : "Slip photo"} · {formatDateTime(s.createdAt)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
