import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/site/Buttons";
import { WorkCard } from "@/components/site/Cards";
import { Img } from "@/components/site/Img";
import { OceanBackdrop } from "@/components/site/OceanBackdrop";
import { Prose } from "@/components/site/Section";
import { VideoPlayer } from "@/components/site/VideoPlayer";
import { getLocation } from "@/lib/public";
import { parseVideoUrl } from "@/lib/video";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await getLocation((await params).slug);
  if (!l) return {};
  return {
    title: `${l.name}, ${l.atoll}`,
    description: l.description.slice(0, 160) || `${l.name} — ${l.kind.toLowerCase()} in ${l.atoll}, Maldives, filmed and photographed by Ocean X.`,
    alternates: { canonical: `/machines/${l.slug}` },
    openGraph: l.cover ? { images: [{ url: `/media/${l.cover.id}`, width: l.cover.width, height: l.cover.height }] } : undefined,
  };
}

export default async function LocationPage({ params }: Props) {
  const l = await getLocation((await params).slug);
  if (!l) notFound();
  const video = parseVideoUrl(l.videoUrl);

  return (
    <>
      <section className="relative flex min-h-[70svh] items-end overflow-hidden bg-abyss text-foam">
        {l.cover ? (
          <div className="absolute inset-0">
            <Img media={l.cover} alt={l.name} priority sizes="100vw" />
          </div>
        ) : (
          <OceanBackdrop />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-abyss via-abyss/30 to-abyss/30" />
        <div className="container-x relative pb-14 pt-32 md:pb-20">
          <p className="eyebrow text-foam/80">
            {l.kind} · {l.atoll}, Maldives
          </p>
          <h1 className="display mt-5 text-5xl [font-stretch:115%] sm:text-6xl lg:text-8xl">{l.name}</h1>
        </div>
      </section>

      <section className="bg-ink py-20 text-foam md:py-28">
        <div className="container-x space-y-16">
          {l.description && <Prose text={l.description} className="max-w-3xl text-lg text-mist" />}
          {video && <VideoPlayer source={video} poster={l.cover ? `/media/${l.cover.id}` : undefined} title={l.name} />}
          {l.images.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {l.images.map((im) => (
                <div key={im.mediaId} data-reveal className="aspect-[4/5] overflow-hidden bg-ink-2">
                  <Img media={im.media} alt={im.media.alt || l.name} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
                </div>
              ))}
            </div>
          )}
          {l.portfolio.length > 0 && (
            <div>
              <p className="eyebrow text-sea">Work at {l.name}</p>
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {l.portfolio.map((w) => (
                  <WorkCard key={w.id} w={{ ...w, location: null }} dark />
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3 border-t border-white/10 pt-10 sm:flex-row sm:items-center sm:justify-between">
            <p className="display text-2xl [font-stretch:110%]">Shoot at {l.name}</p>
            <ButtonLink href={`/book?location=${encodeURIComponent(l.name)}`} arrow>
              BOOK A SESSION
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
