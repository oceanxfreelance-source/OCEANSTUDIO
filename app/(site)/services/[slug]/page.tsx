import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/site/Buttons";
import { Img } from "@/components/site/Img";
import { OceanBackdrop } from "@/components/site/OceanBackdrop";
import { Prose } from "@/components/site/Section";
import { SERVICE_STATUS_LABEL } from "@/lib/constants";
import { instagramDmUrl, priceLabel } from "@/lib/format";
import { getPublicService } from "@/lib/public";
import { VideoPlayer } from "@/components/site/VideoPlayer";
import { SectionHeading } from "@/components/site/Section";
import { parseVideoUrl } from "@/lib/video";
import Link from "next/link";
import { InstagramBookButton } from "@/components/site/InstagramBook";
import { getContent } from "@/lib/content";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await getPublicService((await params).slug);
  if (!s) return {};
  return {
    title: `${s.name} at Machines, Maabaidhoo`,
    description: s.shortDescription || s.description.slice(0, 160),
    alternates: { canonical: `/services/${s.slug}` },
    openGraph: s.cover ? { images: [{ url: `/media/${s.cover.id}`, width: s.cover.width, height: s.cover.height }] } : undefined,
  };
}

export default async function ServicePage({ params }: Props) {
  const s = await getPublicService((await params).slug);
  if (!s) notFound();
  const soon = s.status === "COMING_SOON";
  const dm = instagramDmUrl((await getContent())["social.instagram"]);
  // Every video of every linked portfolio piece, in order.
  const films = s.films.flatMap((f) =>
    (f.videoUrls.length ? f.videoUrls : [f.videoUrl]).flatMap((url, i) => {
      const source = parseVideoUrl(url);
      return source ? [{ key: `${f.id}-${i}`, slug: f.slug, title: f.title, source }] : [];
    }),
  );

  return (
    <>
      <section className="relative flex min-h-[70svh] items-end overflow-hidden bg-abyss text-foam">
        {s.cover ? (
          <div className="absolute inset-0">
            <Img media={s.cover} alt={s.name} priority sizes="100vw" />
          </div>
        ) : (
          <OceanBackdrop />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-abyss via-abyss/40 to-abyss/30" />
        <div className="container-x relative pb-14 pt-32 md:pb-20">
          <span className={soon ? "eyebrow rounded-full bg-foam/10 px-3 py-1.5 text-foam/80 backdrop-blur" : "eyebrow rounded-full bg-gold px-3 py-1.5 text-abyss"}>
            {SERVICE_STATUS_LABEL[s.status]}
          </span>
          <h1 className="display mt-6 max-w-5xl text-5xl [font-stretch:115%] sm:text-6xl lg:text-7xl">{s.name}</h1>
          {s.shortDescription && <p className="mt-5 max-w-2xl text-lg text-foam/80">{s.shortDescription}</p>}
        </div>
      </section>

      <section className="bg-paper py-20 md:py-28">
        <div className="container-x grid gap-14 lg:grid-cols-[1.5fr_1fr] lg:gap-24">
          <div data-reveal>
            {s.description ? <Prose text={s.description} className="text-lg text-slate" /> : <p className="text-lg text-slate">{s.shortDescription}</p>}
          </div>
          <aside data-reveal className="h-fit border border-deep/10 bg-white/60 p-7 lg:sticky lg:top-28">
            <p className="eyebrow text-slate">{soon ? "Status" : "Pricing"}</p>
            <p className="display mt-3 text-3xl [font-stretch:110%]">{soon ? "Coming soon" : priceLabel(s.price, s.priceType, s.currency)}</p>
            <p className="mt-4 text-sm leading-relaxed text-slate">
              {soon
                ? "We're getting this service ready — follow us to hear when it's available."
                : dm
                  ? "Send us a DM on Instagram with your dates and the number of surfers to book."
                  : "Final pricing depends on timing and the number of surfers. Get in touch for details."}
            </p>
            {dm && !soon ? (
              <InstagramBookButton dmUrl={dm} variant="dark" className="mt-7 w-full" />
            ) : (
              <ButtonLink href="/contact" variant="dark" className="mt-7 w-full">
                CONTACT US
              </ButtonLink>
            )}
            <ButtonLink href="/work" variant="outline-dark" className="mt-3 w-full">
              SEE OUR WORK
            </ButtonLink>
          </aside>
        </div>
        {films.length > 0 && (
          <div className="container-x mt-24 md:mt-32">
            <SectionHeading eyebrow="Films" title={films.length === 1 ? "Watch the film" : `${films.length} films from Machines`} intro="Tap any film to play it." />
            <div className="mt-12 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {films.map((f) => (
                <figure key={f.key} data-reveal>
                  <VideoPlayer source={f.source} title={f.title} portrait />
                  <figcaption className="mt-3 flex items-baseline justify-between gap-3 text-sm">
                    <Link href={`/work/${f.slug}`} className="link-underline font-medium">
                      {f.title}
                    </Link>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
        {s.images.length > 0 && (
          <div className="container-x mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {s.images.map((im) => (
              <div key={im.mediaId} data-reveal className="aspect-[4/5] overflow-hidden bg-ink">
                <Img media={im.media} alt={im.media.alt || s.name} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
