import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Badge, Empty, PageHeader, STATUS_TONE, Table } from "@/components/admin/ui";
import { cx } from "@/components/ui/cx";
import { requireAdmin } from "@/lib/auth";
import { BOOKING_STATUS_LABEL } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata = { title: "Bookings" };

type Status = keyof typeof BOOKING_STATUS_LABEL;

export default async function BookingsAdmin({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = (Object.keys(BOOKING_STATUS_LABEL) as Status[]).find((s) => s === sp.status);
  const q = sp.q?.trim().slice(0, 100);

  const where: Prisma.BookingWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { instagram: { contains: q.replace(/^@/, ""), mode: "insensitive" } },
            { whatsapp: { contains: q } },
            { reference: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [bookings, counts] = await Promise.all([
    db.booking.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
    db.booking.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: Status) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <>
      <PageHeader title="Bookings" subtitle="Requests sent from the website's booking form." />
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <Tab href="/superadmin/bookings" active={!status}>All</Tab>
          {(Object.keys(BOOKING_STATUS_LABEL) as Status[]).map((s) => (
            <Tab key={s} href={`/superadmin/bookings?status=${s}`} active={status === s}>
              {BOOKING_STATUS_LABEL[s]} <span className="opacity-60">{count(s)}</span>
            </Tab>
          ))}
        </div>
        <form className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q} placeholder="Search name, @instagram, email…" className="w-full rounded-lg border border-slate/30 bg-white px-3 py-2 text-sm md:w-64" />
        </form>
      </div>
      {bookings.length === 0 ? (
        <Empty>{q || status ? "No bookings match." : "No booking requests yet. They'll appear here as soon as someone uses the booking form."}</Empty>
      ) : (
        <Table head={["Customer", "Service", "Preferred date", "People", "Status", "Received"]}>
          {bookings.map((b) => (
            <tr key={b.id} className={cx("hover:bg-foam/40", b.status === "NEW" && "bg-sky-50/40")}>
              <td className="px-4 py-3">
                <Link href={`/superadmin/bookings/${b.id}`} className="font-medium hover:underline">
                  {b.fullName}
                </Link>
                <span className="block text-xs text-slate">
                  {b.reference}
                  {b.instagram ? ` · @${b.instagram}` : ""}
                </span>
              </td>
              <td className="px-4 py-3 text-slate">
                {b.serviceName || "—"}
                {b.locationText && <span className="block text-xs">{b.locationText}</span>}
              </td>
              <td className="px-4 py-3 text-slate">
                {b.preferredDate ? formatDate(b.preferredDate) : "Flexible"}
                {b.preferredTime && <span className="block text-xs">{b.preferredTime}</span>}
              </td>
              <td className="px-4 py-3 text-slate">{b.people ?? "—"}</td>
              <td className="px-4 py-3">
                <Badge tone={STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
              </td>
              <td className="px-4 py-3 text-xs text-slate">{formatDateTime(b.createdAt)}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={cx("rounded-full border px-3 py-1 text-xs", active ? "border-abyss bg-abyss text-white" : "border-slate/25 bg-white hover:bg-foam")}>
      {children}
    </Link>
  );
}
