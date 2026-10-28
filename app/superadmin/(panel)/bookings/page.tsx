import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Badge, Empty, PageHeader } from "@/components/admin/ui";
import { cx } from "@/components/ui/cx";
import { requireAdmin } from "@/lib/auth";
import { ACTIVE_BOOKING, BOOKING_STATUS_LABEL, BOOKING_TONE, PAY_LABEL } from "@/lib/bookings";
import { dayString, parseDay, todayMaldives } from "@/lib/clips";
import { db } from "@/lib/db";
import { formatDate, money } from "@/lib/format";
import { BOOKING_PACKAGE_LABEL, SLOT_LABEL, SLOTS } from "@/lib/shop-rules";

export const metadata = { title: "Bookings" };

const VIEWS = { upcoming: "Upcoming", requests: "New requests", past: "Past", all: "All" } as const;
type View = keyof typeof VIEWS;

export default async function BookingsAdmin({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const view: View = sp.view && sp.view in VIEWS ? (sp.view as View) : "upcoming";
  const today = parseDay(todayMaldives())!;
  const where: Prisma.BookingWhereInput = {
    token: { not: null },
    ...(view === "upcoming" ? { preferredDate: { gte: today }, status: { in: ACTIVE_BOOKING } } : {}),
    ...(view === "requests" ? { status: "NEW" } : {}),
    ...(view === "past" ? { preferredDate: { lt: today } } : {}),
  };
  const bookings = await db.booking.findMany({
    where,
    orderBy: view === "past" || view === "all" ? [{ preferredDate: "desc" }] : [{ preferredDate: "asc" }],
    take: 200,
    include: { _count: { select: { slips: true, clips: true } } },
  });
  const days = [...new Set(bookings.map((b) => (b.preferredDate ? dayString(b.preferredDate) : "")))];

  return (
    <>
      <PageHeader
        title="Bookings"
        subtitle="Filming sessions booked in advance."
        actions={
          <Link href="/superadmin/bookings/availability" className="rounded-lg border border-slate/30 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-foam">
            Availability
          </Link>
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link key={v} href={`/superadmin/bookings?view=${v}`} className={cx("rounded-full border px-3 py-1 text-xs", view === v ? "border-abyss bg-abyss text-white" : "border-slate/25 bg-white hover:bg-foam")}>
            {VIEWS[v]}
          </Link>
        ))}
      </div>
      {bookings.length === 0 ? (
        <Empty>No bookings here.</Empty>
      ) : (
        <div className="space-y-6">
          {days.map((d) => (
            <section key={d}>
              <h2 className="mb-2 text-sm font-semibold">{d ? formatDate(new Date(`${d}T00:00:00Z`), { weekday: "long", day: "numeric", month: "long" }) : "No date"}</h2>
              <ul className="divide-y divide-slate/10 rounded-xl border border-slate/15 bg-white">
                {bookings
                  .filter((b) => (b.preferredDate ? dayString(b.preferredDate) : "") === d)
                  .sort((a, b) => SLOTS.indexOf(a.slot ?? "MORNING") - SLOTS.indexOf(b.slot ?? "MORNING"))
                  .map((b) => (
                    <li key={b.id}>
                      <Link href={`/superadmin/bookings/${b.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:bg-foam/50">
                        <span className="w-20 text-sm font-semibold">{b.slot ? SLOT_LABEL[b.slot] : "—"}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{b.fullName}</span>
                          <span className="block text-xs text-slate">
                            {b.reference} · {b.serviceName || (b.package ? BOOKING_PACKAGE_LABEL[b.package] : "")} · {b.people ?? 1} surfer{(b.people ?? 1) === 1 ? "" : "s"} · {money(b.price)}
                            {b._count.clips > 0 && ` · ${b._count.clips} clips`}
                          </span>
                        </span>
                        <span className="flex flex-wrap gap-1.5">
                          <Badge tone={BOOKING_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
                          <Badge tone={PAY_LABEL[b.paymentStatus]![1]}>{PAY_LABEL[b.paymentStatus]![0]}</Badge>
                          {b._count.slips > 0 && b.paymentStatus !== "PAID" && <Badge tone="amber">Slip ✓</Badge>}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
