import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/site/Buttons";
import { Pin } from "@/components/site/Icons";
import { Img } from "@/components/site/Img";
import { Prose } from "@/components/site/Section";
import { VideoPlayer } from "@/components/site/VideoPlayer";
import { formatDate, instagramDmUrl } from "@/lib/format";
import { getPortfolioItem } from "@/lib/public";
import { InstagramBookButton } from "@/components/site/InstagramBook";
import { getContent } from "@/lib/content";
import { parseVideoUrl } from "@/lib/video";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const w = await getPortfolioItem((await params).slug);
  if (!w) return {};
  return {
    title: w.title,
    description: w.description.slice(0, 160) || `${w.category} by Ocean X${w.location ? ` — ${w.location.name}, Maabaidhoo` : " at Machines, Maabaidhoo"}.`,
    alternates: { canonical: `/work/${w.slug}` },
    openGraph: w.cover ? { images: [{ url: `/media/${w.cover.id}`, width: w.cover.width, height: w.cover.height }] } : undefined,
  };
}

export default async function WorkItemPage({ params }: Props) {
  const w = await getPortfolioItem((await params).slug);
  if (!w) notFound();
  const video = parseVideoUrl(w.videoUrl);
  const dm = instagramDmUrl((await getContent())["social.instagram"]);

  return (
    <article className="bg-abyss text-foam">
      <header className="container-x pb-10 pt-32 md:pt-44">
        <Link href={`/work?category=${w.category.toLowerCase()}`} className="eyebrow text-gold hover:text-foam">
          {w.category}
        </Link>
        <h1 className="display mt-5 max-w-5xl text-5xl [font-stretch:115%] sm:text-6xl lg:text-7xl">{w.title}</h1>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-mist">
          {w.location && (
            <span className="flex items-center gap-1.5">
              <Pin className="h-4 w-4" />
              {w.location.published ? (
                <Link href={`/machines/${w.location.slug}`} className="hover:text-foam">
                  {w.location.name}
                </Link>
              ) : (
                w.location.name
              )}
            </span>
          )}
          {w.date && <span>{formatDate(w.date, { month: "long", year: "numeric" })}</span>}
        </div>
      </header>

      <div className="container-x">
        {video ? (
          <VideoPlayer source={video} poster={w.cover ? `/media/${w.cover.id}` : undefined} title={w.title} />
        ) : (
          w.cover && (
            <div className="overflow-hidden bg-ink">
              <Img media={w.cover} alt={w.title} priority sizes="(min-width: 1400px) 1300px, 100vw" className="h-auto" />
            </div>
          )
        )}
      </div>

      {w.description && (
        <div className="container-x py-16 md:py-24">
          <Prose text={w.description} className="max-w-3xl text-lg text-mist" />
        </div>
      )}

      {w.images.length > 0 && (
        <div className="container-x grid gap-4 pb-16 sm:grid-cols-2">
          {w.images.map((im, i) => (
            <div key={im.mediaId} data-reveal className={i % 3 === 0 ? "overflow-hidden bg-ink sm:col-span-2" : "overflow-hidden bg-ink"}>
              <Img media={im.media} alt={im.media.alt || w.title} sizes={i % 3 === 0 ? "100vw" : "(min-width: 640px) 50vw, 100vw"} className="h-auto" />
            </div>
          ))}
        </div>
      )}

      <div className="container-x flex flex-col gap-4 border-t border-white/10 py-14 sm:flex-row sm:items-center sm:justify-between">
        <p className="display text-2xl [font-stretch:110%]">{dm ? "Want a film like this?" : "Surfed with us?"}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <InstagramBookButton dmUrl={dm} />
          <ButtonLink href="/work" variant="outline-light">
            MORE WORK
          </ButtonLink>
          <ButtonLink href="/reviews#leave-a-review" arrow>
            LEAVE A REVIEW
          </ButtonLink>
        </div>
      </div>
    </article>
  );
}
