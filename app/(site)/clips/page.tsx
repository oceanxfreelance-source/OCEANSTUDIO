import type { Metadata } from "next";
import Link from "next/link";
import type { DaySlot } from "@prisma/client";
import { ClipCard } from "@/components/site/shop/ClipCard";
import { cx } from "@/components/ui/cx";
import { getGalleryClips, getGalleryDays, getShopSpots, type GalleryClip } from "@/lib/clip-shop";
import { dayString, parseDay, todayMaldives } from "@/lib/clips";
import { formatDate } from "@/lib/format";
import { getShopConfig } from "@/lib/shop";
import { SLOT_LABEL, SLOTS } from "@/lib/shop-rules";

export const metadata: Metadata = {
  title: "Find your surf clips — Machines, Maldives",
  description: "Surfed Machines? Find the clips we filmed of you — by day, session and board colour — and buy the full-quality originals.",
  alternates: { canonical: "/clips" },
};

type SP = { date?: string; spot?: string; slot?: string; q?: string; page?: string };

function dayLabel(d: string): string {
  const today = todayMaldives();
  const yesterday = dayString(new Date(parseDay(today)!.getTime() - 86400_000));
  if (d === today) return "Today";
  if (d === yesterday) return "Yesterday";
  return formatDate(new Date(`${d}T00:00:00Z`), { weekday: "short", day: "numeric", month: "short" });
}

export default async function ClipsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [days, spots, cfg] = await Promise.all([getGalleryDays(), getShopSpots(), getShopConfig()]);
  const q = (sp.q ?? "").slice(0, 60);
  // Open on the newest day — that's when most surfers come looking.
  const dateKey = sp.date === "all" || q ? null : sp.date && parseDay(sp.date) ? sp.date : (days[0]?.date ?? null);
  const date = dateKey ? parseDay(dateKey) : null;
  const slot = SLOTS.find((s) => s === sp.slot) as DaySlot | undefined;
  const spot = spots.find((s) => s.code === sp.spot);
  const page = Math.min(100, Math.max(1, Number(sp.page) || 1));
  const result = await getGalleryClips({ date, slot: slot ?? null, spotId: spot?.id ?? null, q, page });

  const link = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { date: sp.date, spot: sp.spot, slot: sp.slot, q: sp.q, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/clips${s ? `?${s}` : ""}`;
  };
  const chip = (active: boolean) =>
    cx("whitespace-nowrap rounded-full border px-4 py-2.5 text-sm transition-colors", active ? "border-gold bg-gold font-medium text-abyss" : "border-foam/15 text-foam/80 hover:border-gold/60");

  // Group by day + session + spot, so surfers scan "their" session.
  const groups: { key: string; title: string; clips: GalleryClip[] }[] = [];
  for (const c of result.clips) {
    const key = `${dayString(c.date)}|${c.slot}|${c.location?.id ?? ""}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, title: `${SLOT_LABEL[c.slot]}${c.location ? ` · ${c.location.name}` : ""}${dateKey ? "" : ` · ${dayLabel(dayString(c.date))}`}`, clips: [] };
      groups.push(g);
    }
    g.clips.push(c);
  }

  return (
    <section className="min-h-screen bg-abyss pb-32 pt-28 text-foam md:pt-36">
      <div className="container-x">
        <h1 className="display text-4xl [font-stretch:112%] md:text-6xl">Find your clips</h1>
        <ol className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-mist">
          <li>
            <span className="text-gold">1</span> Pick your day & session
          </li>
          <li>
            <span className="text-gold">2</span> Tap to preview
          </li>
          <li>
            <span className="text-gold">3</span> Add yours & check out
          </li>
        </ol>

        {days.length === 0 && !q ? (
          <div className="mt-10 rounded-2xl border border-foam/10 bg-ink p-8 text-center">
            <p className="text-lg">New clips go online the same day we film.</p>
            <p className="mt-2 text-mist">Check back after your session — or book us to film you.</p>
            <Link href="/book" className="mt-6 inline-block rounded-full bg-gold px-7 py-3.5 text-[12px] font-semibold tracking-[0.16em] text-abyss">
              BOOK A SESSION
            </Link>
          </div>
        ) : (
          <>
            {/* Filters: plain links + a GET form, so they work even before scripts load. */}
            <div className="mt-8 space-y-3">
              <nav aria-label="Day" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                {days.map((d) => (
                  <Link key={d.date} href={link({ date: d.date, page: undefined, q: undefined })} className={chip(dateKey === d.date)}>
                    {dayLabel(d.date)} <span className="opacity-60">{d.count}</span>
                  </Link>
                ))}
                <Link href={link({ date: "all", page: undefined })} className={chip(!dateKey)}>
                  All days
                </Link>
              </nav>
              <nav aria-label="Session" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                <Link href={link({ slot: undefined, page: undefined })} className={chip(!slot)}>
                  All sessions
                </Link>
                {SLOTS.map((s) => (
                  <Link key={s} href={link({ slot: s, page: undefined })} className={chip(slot === s)}>
                    {SLOT_LABEL[s]}
                  </Link>
                ))}
                {spots.length > 1 &&
                  spots.map((s) => (
                    <Link key={s.id} href={link({ spot: spot?.id === s.id ? undefined : s.code!, page: undefined })} className={chip(spot?.id === s.id)}>
                      {s.name}
                    </Link>
                  ))}
              </nav>
              <form action="/clips" className="flex gap-2">
                {sp.slot && <input type="hidden" name="slot" value={sp.slot} />}
                {sp.spot && <input type="hidden" name="spot" value={sp.spot} />}
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  aria-label="Search by board or rashguard colour, or clip code"
                  placeholder="Search: “red board”, “MC-2710-07”…"
                  className="min-w-0 flex-1 rounded-full border border-foam/15 bg-ink px-5 py-3 text-sm text-foam placeholder:text-foam/40 focus:border-gold focus:outline-none"
                />
                <button className="rounded-full bg-foam px-5 text-xs font-semibold tracking-[0.14em] text-abyss">SEARCH</button>
              </form>
            </div>

            <p className="mt-6 rounded-xl border border-gold/25 bg-gold/5 px-4 py-3 text-sm text-foam/85">
              <span className="text-gold">${cfg.prices.clip}</span> per clip · never more than <span className="text-gold">${cfg.prices.session}</span> for one session · full-quality download
            </p>

            {q && (
              <p className="mt-6 text-sm text-mist">
                {result.total} result{result.total === 1 ? "" : "s"} for “{q}” ·{" "}
                <Link href={link({ q: undefined, page: undefined })} className="underline">
                  clear search
                </Link>
              </p>
            )}

            {groups.length === 0 ? (
              <p className="mt-10 text-center text-mist">No clips match yet. Try another day or session.</p>
            ) : (
              groups.map((g) => (
                <div key={g.key} className="mt-10">
                  <h2 className="flex items-baseline justify-between border-b border-foam/10 pb-3">
                    <span className="text-lg font-medium">{g.title}</span>
                    <span className="text-sm text-mist">
                      {g.clips.length} clip{g.clips.length === 1 ? "" : "s"}
                    </span>
                  </h2>
                  <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
                    {g.clips.map((c) => (
                      <li key={c.id}>
                        <ClipCard
                          clip={{
                            id: c.id,
                            code: c.code,
                            date: dayString(c.date),
                            dateLabel: formatDate(c.date, { day: "numeric", month: "short" }),
                            slot: c.slot,
                            spot: c.location?.code ?? "OX",
                            spotName: c.location?.name ?? "Ocean X",
                            description: c.description,
                            seconds: c.seconds,
                            previewUrl: c.previewUrl,
                            posterUrl: c.posterUrl,
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}

            {result.pages > 1 && (
              <nav aria-label="Pages" className="mt-10 flex items-center justify-center gap-4 text-sm">
                {result.page > 1 && (
                  <Link href={link({ page: String(result.page - 1) })} className="rounded-full border border-foam/25 px-5 py-2.5">
                    ← Previous
                  </Link>
                )}
                <span className="text-mist">
                  Page {result.page} of {result.pages}
                </span>
                {result.page < result.pages && (
                  <Link href={link({ page: String(result.page + 1) })} className="rounded-full border border-foam/25 px-5 py-2.5">
                    More clips →
                  </Link>
                )}
              </nav>
            )}
          </>
        )}

        <p className="mx-auto mt-16 max-w-2xl border-t border-foam/10 pt-6 text-center text-xs leading-relaxed text-mist">
          {cfg.notice}{" "}
          <Link href="/remove" className="text-gold underline">
            Remove my clip
          </Link>
        </p>
      </div>
    </section>
  );
}
