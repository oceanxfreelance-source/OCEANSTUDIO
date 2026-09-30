import Link from "next/link";
import { formatDate, instagramUrl } from "@/lib/format";
import type { MediaRef } from "@/lib/public";
import { Img } from "./Img";
import { Stars } from "./Stars";

type T = { id: string; name: string; instagram: string | null; text: string; rating: number | null; date: Date | null; createdAt: Date; avatar: MediaRef | null };

/** A grid of review cards. */
export function ReviewGrid({ items }: { items: T[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map((t) => {
        const ig = instagramUrl(t.instagram);
        return (
          <figure key={t.id} data-reveal className="flex flex-col justify-between border border-deep/10 bg-white/60 p-7">
            <div>
              {t.rating && <Stars value={t.rating} className="text-deep" />}
              <blockquote className="mt-4 whitespace-pre-line text-lg leading-relaxed">“{t.text}”</blockquote>
            </div>
            <figcaption className="mt-8 flex items-center gap-3">
              {t.avatar ? (
                <span className="h-10 w-10 overflow-hidden rounded-full">
                  <Img media={t.avatar} alt={t.name} sizes="40px" />
                </span>
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sand text-sm font-semibold uppercase">{t.name.slice(0, 1)}</span>
              )}
              <span className="text-sm">
                <span className="block font-semibold">{t.name}</span>
                <span className="text-slate">
                  {ig ? (
                    <a href={ig} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-deep">
                      @{t.instagram}
                    </a>
                  ) : null}
                  {ig ? " · " : ""}
                  {formatDate(t.date ?? t.createdAt, { month: "short", year: "numeric" })}
                </span>
              </span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/** Home / About section: featured reviews + average + link to all reviews. */
export function Testimonials({ items, stats, title = "What surfers say" }: { items: T[]; stats: { count: number; average: number | null }; title?: string }) {
  return (
    <section className="bg-paper py-24 md:py-32">
      <div className="container-x">
        <div data-reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow text-gold-deep">Reviews</p>
            <h2 className="display mt-4 text-4xl [font-stretch:112%] sm:text-5xl">{title}</h2>
            {stats.average && (
              <p className="mt-4 flex items-center gap-3 text-slate">
                <Stars value={stats.average} className="text-deep" />
                <span>
                  <span className="font-semibold text-deep">{stats.average.toFixed(1)}</span> from {stats.count} review{stats.count === 1 ? "" : "s"}
                </span>
              </p>
            )}
          </div>
          <Link href="/reviews" className="self-start rounded-full border border-deep/25 px-7 py-4 text-[12px] font-semibold tracking-[0.16em] hover:border-deep md:self-auto">
            ALL REVIEWS & LEAVE ONE
          </Link>
        </div>
        <div className="mt-14">
          <ReviewGrid items={items} />
        </div>
      </div>
    </section>
  );
}
