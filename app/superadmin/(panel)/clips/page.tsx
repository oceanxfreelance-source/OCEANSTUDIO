import Link from "next/link";
import { after } from "next/server";
import { cleanupOldFiles } from "@/lib/cleanup";
import type { Prisma } from "@prisma/client";
import { Badge, ButtonLink, Empty, PageHeader } from "@/components/admin/ui";
import { cx } from "@/components/ui/cx";
import { requireAdmin } from "@/lib/auth";
import { parseDay } from "@/lib/clips";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { SLOT_LABEL } from "@/lib/shop-rules";

export const metadata = { title: "Clips" };

const VIEWS = { all: "All", gallery: "In gallery", booked: "For bookings", hidden: "Hidden", failed: "Needs attention" } as const;
type View = keyof typeof VIEWS;

export default async function ClipsAdmin({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  await requireAdmin();
  // Also tidy up here, so old clips go even between nightly runs.
  after(() => cleanupOldFiles().catch((e) => console.error("cleanup failed", e)));
  const sp = await searchParams;
  const view: View = sp.view && sp.view in VIEWS ? (sp.view as View) : "all";
  const date = parseDay(sp.date);
  const where: Prisma.ClipWhereInput = {
    ...(date ? { date } : {}),
    ...(view === "gallery" ? { bookingId: null, hidden: false, status: "READY" } : {}),
    ...(view === "booked" ? { bookingId: { not: null } } : {}),
    ...(view === "hidden" ? { hidden: true } : {}),
    ...(view === "failed" ? { status: { not: "READY" } } : {}),
  };
  const clips = await db.clip.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 240,
    include: { location: { select: { name: true } }, booking: { select: { reference: true, fullName: true } }, _count: { select: { orderItems: true } } },
  });
  const qs = (v: View) => `/superadmin/clips?view=${v}${date ? `&date=${sp.date}` : ""}`;

  return (
    <>
      <PageHeader title="Clips" subtitle="Booked clips are private to that surfer; the rest are in the public gallery. Unsold clips are deleted automatically after 24 hours (change this in Website content → Clip shop)." actions={<ButtonLink href="/superadmin/clips/upload">+ Upload clips</ButtonLink>} />
      <form className="mb-4 flex flex-wrap items-end gap-3" action="/superadmin/clips">
        <input type="hidden" name="view" value={view} />
        <label className="text-xs font-medium text-slate">
          Day
          <input type="date" name="date" defaultValue={sp.date ?? ""} className="mt-1 block rounded-lg border border-slate/30 bg-white px-3 py-2 text-sm text-deep" />
        </label>
        <button className="rounded-lg border border-slate/30 bg-white px-4 py-2 text-sm font-semibold hover:bg-foam">Show</button>
        {date && (
          <Link href={`/superadmin/clips?view=${view}`} className="py-2 text-sm text-slate underline">
            All days
          </Link>
        )}
      </form>
      <div className="mb-5 flex flex-wrap gap-2">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link key={v} href={qs(v)} className={cx("rounded-full border px-3 py-1 text-xs", view === v ? "border-abyss bg-abyss text-white" : "border-slate/25 bg-white hover:bg-foam")}>
            {VIEWS[v]}
          </Link>
        ))}
      </div>
      {clips.length === 0 ? (
        <Empty>
          No clips here. <Link href="/superadmin/clips/upload" className="text-gold-deep underline">Upload a session</Link>.
        </Empty>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {clips.map((c) => (
            <li key={c.id}>
              <Link href={`/superadmin/clips/${c.id}`} className="block overflow-hidden rounded-lg border border-slate/15 bg-white hover:border-slate/40">
                <span className="block aspect-[4/5] bg-ink">
                  {c.posterUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="block p-2.5">
                  <span className="block font-mono text-xs font-semibold">{c.code}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate">
                    {formatDate(c.date, { day: "numeric", month: "short" })} · {SLOT_LABEL[c.slot]} · {c.location?.name ?? "—"}
                  </span>
                  {c.description && <span className="mt-0.5 block truncate text-[11px]">{c.description}</span>}
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {c.status !== "READY" && <Badge tone={c.status === "FAILED" ? "red" : "amber"}>{c.status === "FAILED" ? "Preview failed" : "Processing"}</Badge>}
                    {c.hidden && <Badge>Hidden</Badge>}
                    {c.booking ? <Badge tone="purple">{c.booking.reference}</Badge> : !c.hidden && c.status === "READY" && <Badge tone="green">Gallery</Badge>}
                    {c._count.orderItems > 0 && <Badge tone="blue">Sold</Badge>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
