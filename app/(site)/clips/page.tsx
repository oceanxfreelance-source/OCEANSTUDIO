import type { Metadata } from "next";
import Link from "next/link";
import type { DaySlot } from "@prisma/client";
import { PageHero } from "@/components/site/Section";
import { ClipCard } from "@/components/site/shop/ClipCard";
import { cx } from "@/components/ui/cx";
import { getGalleryClips, getGalleryDays, getShopSpots } from "@/lib/clip-shop";
import { dayString, parseDay } from "@/lib/clips";
import { formatDate } from "@/lib/format";
import { getShopConfig } from "@/lib/shop";
import { SLOT_LABEL, SLOTS } from "@/lib/shop-rules";

export const metadata: Metadata = {
  title: "Find your surf clips — Machines, Maldives",
  description: "Surfed Machines? Find the clips we filmed of you — by day, session and board colour — and buy the full-quality originals.",
  alternates: { canonical: "/clips" },
};

type SP = { date?: string; spot?: string; slot?: string; q?: string; page?: string };

export default async function ClipsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [days, spots, cfg] = await Promise.all([getGalleryDays(), getShopSpots(), getShopConfig()]);
  const date = parseDay(sp.date);
  const slot = SLOTS.find((s) => s === sp.slot) as DaySlot | undefined;
  const spot = spots.find((s) => s.code === sp.spot);
  const q = (sp.q ?? "").slice(0, 60);
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
    cx("whitespace-nowrap rounded-full border px-4 py-2 text-xs tracking-wide transition-colors", active ? "border-gold bg-gold text-abyss" : "border-foam/20 text-foam/80 hover:border-gold/60");

  return (
    <>
      <PageHero eyebrow="Your clips" title="Find your waves." intro={`Every session we film the line-up. Find yourself, tap to preview, and buy the full-quality clip — $${cfg.prices.clip} each, never more than $${cfg.prices.session} per session.`} />

      <section className="bg-abyss pb-32 text-foam">
        <div className="container-x">
          {/* Filters work without JavaScript (plain links + a GET form). */}
          <div className="space-y-3 py-4">
            <nav aria-label="Day" className="flex gap-2 overflow-x-auto pb-1">
              <Link href={link({ date: undefined, page: undefined })} className={chip(!date)}>
                All days
              </Link>
              {days.map((d) => (
                <Link key={d.date} href={link({ date: d.date, page: undefined })} className={chip(date ? dayString(date) === d.date : false)}>
                  {formatDate(new Date(`${d.date}T00:00:00Z`), { weekday: "short", day: "numeric", month: "short" })} <span className="opacity-60">({d.count})</span>
                </Link>
              ))}
            </nav>
            <nav aria-label="Session" className="flex gap-2 overflow-x-auto pb-1">
              <Link href={link({ slot: undefined, page: undefined })} className={chip(!slot)}>
                Any time
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
              {sp.date && <input type="hidden" name="date" value={sp.date} />}
              {sp.slot && <input type="hidden" name="slot" value={sp.slot} />}
              {sp.spot && <input type="hidden" name="spot" value={sp.spot} />}
              <input
                type="search"
                name="q"
                defaultValue={q}
                aria-label="Search by board or rashguard colour, or clip code"
                placeholder="Board or rashguard colour, or clip code…"
                className="min-w-0 flex-1 rounded-full border border-foam/20 bg-ink px-5 py-3 text-sm text-foam placeholder:text-foam/40 focus:border-gold focus:outline-none"
              />
              <button className="rounded-full border border-foam/25 px-5 text-xs font-semibold tracking-[0.14em] hover:border-gold hover:text-gold">SEARCH</button>
            </form>
          </div>

          <p className="mt-6 text-sm text-mist">
            {result.total === 0 ? "No clips match yet." : `${result.total} clip${result.total === 1 ? "" : "s"}`}
            {q && (
              <>
                {" "}
                for “{q}” ·{" "}
                <Link href={link({ q: undefined, page: undefined })} className="underline">
                  clear
                </Link>
              </>
            )}
          </p>

          {result.clips.length > 0 ? (
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {result.clips.map((c) => (
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
          ) : (
            <div className="mt-8 border border-foam/10 p-8 text-center text-mist">
              <p>Clips are uploaded the same day we film. Check back after your session — or message us and we&apos;ll find you.</p>
              <Link href="/book" className="mt-5 inline-block text-sm text-gold underline">
                Or book us to film your session →
              </Link>
            </div>
          )}

          {result.pages > 1 && (
            <nav aria-label="Pages" className="mt-10 flex items-center justify-center gap-4 text-sm">
              {result.page > 1 && (
                <Link href={link({ page: String(result.page - 1) })} className="rounded-full border border-foam/25 px-5 py-2.5">
                  ← Newer
                </Link>
              )}
              <span className="text-mist">
                Page {result.page} of {result.pages}
              </span>
              {result.page < result.pages && (
                <Link href={link({ page: String(result.page + 1) })} className="rounded-full border border-foam/25 px-5 py-2.5">
                  Older →
                </Link>
              )}
            </nav>
          )}

          <p className="mx-auto mt-14 max-w-2xl border-t border-foam/10 pt-6 text-center text-xs leading-relaxed text-mist">
            {cfg.notice}{" "}
            <Link href="/remove" className="text-gold underline">
              Remove my clip
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
