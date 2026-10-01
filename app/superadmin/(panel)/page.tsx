import Link from "next/link";
import { Badge, Card, Empty, PageHeader, Stat } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { OptimiseAll } from "@/components/admin/OptimiseAll";
import { getContent } from "@/lib/content";
import { needsOptimising } from "@/lib/video";
import { db } from "@/lib/db";
import { formatDate, money } from "@/lib/format";
import { StarsInline } from "@/components/admin/StarsInline";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const admin = await requireAdmin();
  const content = await getContent();
  const instagram = content["social.instagram"];
  const videoRefs = await Promise.all([
    db.portfolioItem.findMany({ where: { OR: [{ videoUrl: { not: null } }, { videoUrls: { isEmpty: false } }] }, select: { videoUrl: true, videoUrls: true } }),
    db.location.findMany({ where: { videoUrl: { not: null } }, select: { videoUrl: true } }),
  ]);
  const [workVideos, placeVideos] = videoRefs;
  const allVideos = [...workVideos.flatMap((r) => [r.videoUrl, ...r.videoUrls]), ...placeVideos.map((r) => r.videoUrl), content["hero.videoUrl"]];
  const toOptimise = [...new Set(allVideos.filter(needsOptimising) as string[])];
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const [pendingReviews, reviewAgg, upcoming, completedSessions, revenueAll, revenueMonth, activeServices, soonServices, latestPending, upcomingSessions, recentCustomers, recentWork] =
    await Promise.all([
      db.testimonial.count({ where: { pending: true } }),
      db.testimonial.aggregate({ where: { published: true }, _count: true, _avg: { rating: true } }),
      db.shootSession.count({ where: { status: "SCHEDULED", date: { gte: today } } }),
      db.shootSession.count({ where: { status: "COMPLETED" } }),
      db.shootSession.aggregate({ _sum: { price: true }, where: { paymentStatus: "PAID", status: { not: "CANCELLED" } } }),
      db.shootSession.aggregate({ _sum: { price: true }, where: { paymentStatus: "PAID", status: { not: "CANCELLED" }, date: { gte: monthStart } } }),
      db.service.count({ where: { status: "ACTIVE", published: true } }),
      db.service.count({ where: { status: "COMING_SOON", published: true } }),
      db.testimonial.findMany({ where: { pending: true }, orderBy: { createdAt: "desc" }, take: 6 }),
      db.shootSession.findMany({ where: { status: "SCHEDULED", date: { gte: today } }, orderBy: [{ date: "asc" }], take: 5, include: { customer: { select: { name: true } } } }),
      db.customer.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { _count: { select: { sessions: true } } } }),
      db.portfolioItem.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, category: true, published: true, createdAt: true } }),
    ]);

  return (
    <>
      <PageHeader title={`Hello, ${admin.name.split(" ")[0]}`} subtitle="Here's what's happening at Ocean X." />

      {toOptimise.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-semibold">
            {toOptimise.length} video{toOptimise.length === 1 ? "" : "s"} can&apos;t play on some phones yet
          </p>
          <p className="mt-1 text-sm text-slate">
            Drone and phone cameras record in a heavy format. One tap converts {toOptimise.length === 1 ? "it" : "them"} into a light version every phone can play (about a minute each).
          </p>
          <OptimiseAll urls={toOptimise} />
        </div>
      )}

      {!instagram && (
        <Link href="/superadmin/content#Contact%20%26%20social" className="mb-6 block rounded-xl border border-gold/50 bg-gold/10 p-5 hover:bg-gold/15">
          <p className="font-semibold">Add your Instagram username</p>
          <p className="mt-1 text-sm text-slate">
            Guests book sessions by sending you a DM on Instagram. Add your username under Website content → Contact &amp; social and the “Book via Instagram” buttons appear across the site.
          </p>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Reviews to approve" value={pendingReviews} href="/superadmin/testimonials" tone={pendingReviews ? "accent" : "default"} />
        <Stat label="Average rating" value={reviewAgg._avg.rating ? `${reviewAgg._avg.rating.toFixed(1)} ★` : "—"} href="/superadmin/testimonials" />
        <Stat label="Upcoming sessions" value={upcoming} href="/superadmin/sessions?status=SCHEDULED" />
        <Stat label="Completed sessions" value={completedSessions} href="/superadmin/sessions?status=COMPLETED" />
        <Stat label="Revenue this month" value={money(revenueMonth._sum.price)} />
        <Stat label="Revenue all time" value={money(revenueAll._sum.price)} />
        <Stat label="Active services" value={activeServices} href="/superadmin/services" />
        <Stat label="Coming soon" value={soonServices} href="/superadmin/services" />
      </div>
      <p className="mt-2 text-xs text-slate">Revenue counts sessions marked as Paid.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card title={`Reviews waiting for approval (${pendingReviews})`} actions={<Link href="/superadmin/testimonials" className="text-sm text-gold-deep hover:underline">All reviews</Link>}>
          {latestPending.length === 0 ? (
            <Empty>No reviews waiting. New reviews from the website appear here. ({reviewAgg._count} published)</Empty>
          ) : (
            <ul className="divide-y divide-slate/10">
              {latestPending.map((r) => (
                <li key={r.id}>
                  <Link href="/superadmin/testimonials" className="block py-3 hover:bg-foam/40">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-medium">{r.name}</span>
                      {r.rating && <StarsInline value={r.rating} />}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate">
                      “{r.text}” · {formatDate(r.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Upcoming sessions" actions={<Link href="/superadmin/sessions" className="text-sm text-gold-deep hover:underline">All sessions</Link>}>
          {upcomingSessions.length === 0 ? (
            <Empty>No sessions scheduled.</Empty>
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

        <Card title="Recent customers" actions={<Link href="/superadmin/customers" className="text-sm text-gold-deep hover:underline">All customers</Link>}>
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
                    <span className="text-xs text-slate">{c._count.sessions} session{c._count.sessions === 1 ? "" : "s"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent portfolio uploads" actions={<Link href="/superadmin/portfolio/new" className="text-sm text-gold-deep hover:underline">+ Add work</Link>}>
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
