import { formatDate, instagramUrl } from "@/lib/format";
import type { MediaRef } from "@/lib/public";
import { Img } from "./Img";

type T = { id: string; name: string; instagram: string | null; text: string; date: Date | null; avatar: MediaRef | null };

export function Testimonials({ items, title = "From the water" }: { items: T[]; title?: string }) {
  return (
    <section className="bg-paper py-24 md:py-32">
      <div className="container-x">
        <p data-reveal className="eyebrow text-sea-deep">Kind words</p>
        <h2 data-reveal className="display mt-4 text-4xl [font-stretch:112%] sm:text-5xl">{title}</h2>
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => {
            const ig = instagramUrl(t.instagram);
            return (
              <figure key={t.id} data-reveal className="flex flex-col justify-between border border-deep/10 bg-white/50 p-7">
                <blockquote className="text-lg leading-relaxed">“{t.text}”</blockquote>
                <figcaption className="mt-8 flex items-center gap-3">
                  {t.avatar ? (
                    <span className="h-10 w-10 overflow-hidden rounded-full">
                      <Img media={t.avatar} alt={t.name} sizes="40px" />
                    </span>
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sand text-sm font-semibold">{t.name.slice(0, 1)}</span>
                  )}
                  <span className="text-sm">
                    <span className="block font-semibold">{t.name}</span>
                    <span className="text-slate">
                      {ig ? (
                        <a href={ig} target="_blank" rel="noopener noreferrer" className="hover:text-deep">
                          @{t.instagram}
                        </a>
                      ) : null}
                      {ig && t.date ? " · " : ""}
                      {t.date ? formatDate(t.date, { month: "short", year: "numeric" }) : ""}
                    </span>
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
