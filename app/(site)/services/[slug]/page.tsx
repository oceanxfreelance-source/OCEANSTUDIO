import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/site/Buttons";
import { Img } from "@/components/site/Img";
import { OceanBackdrop } from "@/components/site/OceanBackdrop";
import { Prose } from "@/components/site/Section";
import { SERVICE_STATUS_LABEL } from "@/lib/constants";
import { priceLabel } from "@/lib/format";
import { getPublicService } from "@/lib/public";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await getPublicService((await params).slug);
  if (!s) return {};
  return {
    title: `${s.name} in Laamu, Maldives`,
    description: s.shortDescription || s.description.slice(0, 160),
    alternates: { canonical: `/services/${s.slug}` },
    openGraph: s.cover ? { images: [{ url: `/media/${s.cover.id}`, width: s.cover.width, height: s.cover.height }] } : undefined,
  };
}

export default async function ServicePage({ params }: Props) {
  const s = await getPublicService((await params).slug);
  if (!s) notFound();
  const soon = s.status === "COMING_SOON";

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
          <span className={soon ? "eyebrow rounded-full bg-foam/10 px-3 py-1.5 text-foam/80 backdrop-blur" : "eyebrow rounded-full bg-sea px-3 py-1.5 text-abyss"}>
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
              {soon ? "We're getting this service ready. Register your interest and we'll let you know when it's available." : "Final pricing depends on location, timing and group size. Send a request and we'll confirm the details."}
            </p>
            <ButtonLink href={`/book?service=${s.id}`} variant="dark" className="mt-7 w-full">
              {soon ? "REGISTER INTEREST" : "BOOK THIS SERVICE"}
            </ButtonLink>
          </aside>
        </div>
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
