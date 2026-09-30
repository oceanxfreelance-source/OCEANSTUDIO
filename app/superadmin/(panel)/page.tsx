import Link from "next/link";
import { Badge, Card, Empty, PageHeader, Stat, STATUS_TONE } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { BOOKING_STATUS_LABEL } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, money } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const admin = await requireAdmin();
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const [newBookings, confirmedBookings, upcoming, completedSessions, revenueAll, revenueMonth, activeServices, soonServices, latestBookings, upcomingSessions, recentCustomers, recentWork] =
    await Promise.all([
      db.booking.count({ where: { status: "NEW" } }),
      db.booking.count({ where: { status: "CONFIRMED" } }),
      db.shootSession.count({ where: { status: "SCHEDULED", date: { gte: today } } }),
      db.shootSession.count({ where: { status: "COMPLETED" } }),
      db.shootSession.aggregate({ _sum: { price: true }, where: { paymentStatus: "PAID", status: { not: "CANCELLED" } } }),
      db.shootSession.aggregate({ _sum: { price: true }, where: { paymentStatus: "PAID", status: { not: "CANCELLED" }, date: { gte: monthStart } } }),
      db.service.count({ where: { status: "ACTIVE", published: true } }),
      db.service.count({ where: { status: "COMING_SOON", published: true } }),
      db.booking.findMany({ where: { status: { in: ["NEW", "CONTACTED"] } }, orderBy: { createdAt: "desc" }, take: 6 }),
      db.shootSession.findMany({ where: { status: "SCHEDULED", date: { gte: today } }, orderBy: [{ date: "asc" }], take: 5, include: { customer: { select: { name: true } } } }),
      db.customer.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { _count: { select: { bookings: true } } } }),
      db.portfolioItem.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, category: true, published: true, createdAt: true } }),
    ]);

  return (
    <>
      <PageHeader title={`Hello, ${admin.name.split(" ")[0]}`} subtitle="Here's what's happening at Ocean X." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="New requests" value={newBookings} href="/superadmin/bookings?status=NEW" tone={newBookings ? "accent" : "default"} />
        <Stat label="Confirmed bookings" value={confirmedBookings} href="/superadmin/bookings?status=CONFIRMED" />
        <Stat label="Upcoming sessions" value={upcoming} href="/superadmin/sessions?status=SCHEDULED" />
        <Stat label="Completed sessions" value={completedSessions} href="/superadmin/sessions?status=COMPLETED" />
        <Stat label="Revenue this month" value={money(revenueMonth._sum.price)} />
        <Stat label="Revenue all time" value={money(revenueAll._sum.price)} />
        <Stat label="Active services" value={activeServices} href="/superadmin/services" />
        <Stat label="Coming soon" value={soonServices} href="/superadmin/services" />
      </div>
      <p className="mt-2 text-xs text-slate">Revenue counts sessions marked as Paid.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card title="Requests to answer" actions={<Link href="/superadmin/bookings" className="text-sm text-sea-deep hover:underline">All bookings</Link>}>
          {latestBookings.length === 0 ? (
            <Empty>No open requests. New bookings from the website appear here.</Empty>
          ) : (
            <ul className="divide-y divide-slate/10">
              {latestBookings.map((b) => (
                <li key={b.id}>
                  <Link href={`/superadmin/bookings/${b.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-foam/40">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{b.fullName}</span>
                      <span className="block truncate text-xs text-slate">
                        {b.serviceName || "No service chosen"} · {b.preferredDate ? formatDate(b.preferredDate) : "Date flexible"} · sent {formatDateTime(b.createdAt)}
                      </span>
                    </span>
                    <Badge tone={STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Upcoming sessions" actions={<Link href="/superadmin/sessions" className="text-sm text-sea-deep hover:underline">All sessions</Link>}>
          {upcomingSessions.length === 0 ? (
            <Empty>No sessions scheduled. Confirm a booking to create one.</Empty>
          ) : (
            <ul className="divide-y divide-slate/10">
              {upcomingSessions.map((s) => (
                <li key={s.id}>
                  <Link href={`/superadmin/sessions/${s.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-foam/40">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.customer.name}</span>
                      <span className="block truncate text-xs text-slate">
                        {s.code} · {s.serviceName || "Session"} · {s.locationText || "Location TBC"}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-sm">
                      {formatDate(s.date, { weekday: "short", day: "numeric", month: "short" })}
                      {s.time ? ` · ${s.time}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent customers" actions={<Link href="/superadmin/customers" className="text-sm text-sea-deep hover:underline">All customers</Link>}>
          {recentCustomers.length === 0 ? (
            <Empty>No customers yet.</Empty>
          ) : (
            <ul className="divide-y divide-slate/10">
              {recentCustomers.map((c) => (
                <li key={c.id}>
                  <Link href={`/superadmin/customers/${c.id}`} className="flex items-center justify-between py-3 hover:bg-foam/40">
                    <span>
                      <span className="block font-medium">{c.name}</span>
                      <span className="text-xs text-slate">{c.instagram ? `@${c.instagram}` : c.email ?? c.whatsapp ?? ""}</span>
                    </span>
                    <span className="text-xs text-slate">{c._count.bookings} booking{c._count.bookings === 1 ? "" : "s"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent portfolio uploads" actions={<Link href="/superadmin/portfolio/new" className="text-sm text-sea-deep hover:underline">+ Add work</Link>}>
          {recentWork.length === 0 ? (
            <Empty>No portfolio items yet.</Empty>
          ) : (
            <ul className="divide-y divide-slate/10">
              {recentWork.map((w) => (
                <li key={w.id}>
                  <Link href={`/superadmin/portfolio/${w.id}`} className="flex items-center justify-between py-3 hover:bg-foam/40">
                    <span>
                      <span className="block font-medium">{w.title}</span>
                      <span className="text-xs text-slate">
                        {w.category} · added {formatDate(w.createdAt)}
                      </span>
                    </span>
                    <Badge tone={w.published ? "green" : "gray"}>{w.published ? "Published" : "Draft"}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
