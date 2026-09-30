import Link from "next/link";
import { ButtonLink } from "@/components/site/Buttons";
import { LocationCard, ServiceCard, WorkCard } from "@/components/site/Cards";
import { HeroVideo } from "@/components/site/HeroVideo";
import { ArrowRight, Instagram } from "@/components/site/Icons";
import { Img } from "@/components/site/Img";
import { OceanBackdrop } from "@/components/site/OceanBackdrop";
import { Prose, SectionHeading } from "@/components/site/Section";
import { Testimonials } from "@/components/site/Testimonials";
import { getContent } from "@/lib/content";
import { db } from "@/lib/db";
import { instagramUrl } from "@/lib/format";
import { getFeaturedWork, getLocations, getPublicServices, getTestimonials } from "@/lib/public";
import { parseVideoUrl } from "@/lib/video";

export default async function HomePage() {
  const [c, services, work, locations, testimonials] = await Promise.all([
    getContent(),
    getPublicServices(),
    getFeaturedWork(5),
    getLocations(),
    getTestimonials(true),
  ]);
  const heroImage = c["hero.imageId"]
    ? await db.mediaAsset.findUnique({ where: { id: c["hero.imageId"] }, select: { id: true, width: true, height: true, alt: true } })
    : null;
  const heroVideo = parseVideoUrl(c["hero.videoUrl"]);
  const ig = instagramUrl(c["social.instagram"]);
  const [lead, ...rest] = work;

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative flex min-h-[100svh] items-end overflow-hidden bg-abyss text-foam">
        {heroImage ? (
          <div className="absolute inset-0">
            <Img media={heroImage} alt={heroImage.alt || "Ocean X — Laamu, Maldives"} priority sizes="100vw" />
          </div>
        ) : (
          <OceanBackdrop />
        )}
        {heroVideo?.kind === "file" && <HeroVideo src={heroVideo.url} poster={heroImage ? `/media/${heroImage.id}` : undefined} />}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-abyss via-abyss/30 to-abyss/40" />

        <div className="container-x relative pb-16 pt-32 md:pb-24">
          <p className="eyebrow text-foam/80">{c["hero.location"]}</p>
          <h1 className="display mt-6 max-w-[14ch] text-[clamp(3rem,11vw,9.5rem)] [font-stretch:118%]">{c["hero.title"]}</h1>
          <div className="mt-8 flex flex-col gap-8 md:mt-10 md:flex-row md:items-end md:justify-between">
            <p className="max-w-md text-lg leading-relaxed text-foam/80 md:text-xl">{c["hero.subtitle"]}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/book" variant="light">
                {c["hero.primaryCta"]}
              </ButtonLink>
              <ButtonLink href="/work" variant="outline-light" arrow>
                {c["hero.secondaryCta"]}
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* ── Intro ─────────────────────────────────────────── */}
      <section className="bg-paper py-24 md:py-36">
        <div className="container-x grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-24">
          <div data-reveal>
            <p className="eyebrow text-sea-deep">Ocean X</p>
            <h2 className="display mt-5 text-4xl [font-stretch:112%] sm:text-5xl lg:text-6xl">{c["home.introTitle"]}</h2>
          </div>
          <div data-reveal className="lg:pt-10">
            <Prose text={c["home.introBody"]} className="text-lg text-slate" />
            {services.length > 0 && (
              <ul className="mt-10 divide-y divide-deep/10 border-y border-deep/10">
                {services.map((s) => (
                  <li key={s.id}>
                    <Link href={`/services/${s.slug}`} className="group flex items-center justify-between py-4">
                      <span className="font-medium">{s.name}</span>
                      <span className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate">
                        {s.status === "ACTIVE" ? <span className="text-sea-deep">Available</span> : "Coming soon"}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ── Featured work ─────────────────────────────────── */}
      {lead && (
        <section className="bg-abyss py-24 text-foam md:py-32">
          <div className="container-x">
            <SectionHeading
              dark
              eyebrow="Our work"
              title="Selected work"
              intro={c["work.intro"]}
              action={
                <ButtonLink href="/work" variant="outline-light" arrow className="self-start md:self-auto">
                  VIEW ALL WORK
                </ButtonLink>
              }
            />
            <div className="mt-14 grid gap-6 md:grid-cols-3 md:gap-8">
              <div className="md:col-span-2">
                <WorkCard w={lead} large dark />
              </div>
              {rest.map((w) => (
                <WorkCard key={w.id} w={w} dark />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Services ──────────────────────────────────────── */}
      {services.length > 0 && (
        <section className="bg-foam py-24 md:py-32">
          <div className="container-x">
            <SectionHeading eyebrow="Services" title="What we create" intro={c["services.intro"]} />
            <div className="mt-14 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {services.slice(0, 6).map((s, i) => (
                <ServiceCard key={s.id} s={s} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Laamu ─────────────────────────────────────────── */}
      <section className="bg-ink py-24 text-foam md:py-32">
        <div className="container-x">
          <SectionHeading
            dark
            eyebrow="Laamu • Maldives"
            title="Home waters."
            intro={c["laamu.intro"]}
            action={
              <ButtonLink href="/laamu" variant="outline-light" arrow className="self-start md:self-auto">
                EXPLORE LAAMU
              </ButtonLink>
            }
          />
          {locations.length > 0 && (
            <div className="-mx-5 mt-14 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
              {locations.slice(0, 4).map((l) => (
                <div key={l.id} className="w-[75vw] shrink-0 snap-start sm:w-auto">
                  <LocationCard l={l} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────── */}
      {testimonials.length > 0 && <Testimonials items={testimonials} />}

      {/* ── Call to action ────────────────────────────────── */}
      <section className="relative overflow-hidden bg-abyss py-28 text-foam md:py-40">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_80%_at_80%_100%,rgba(47,127,134,0.35),transparent_70%)]" />
        <div className="container-x relative" data-reveal>
          <p className="eyebrow text-sea">Book a session</p>
          <h2 className="display mt-5 max-w-4xl text-5xl [font-stretch:115%] sm:text-6xl lg:text-7xl">{c["cta.title"]}</h2>
          <p className="mt-6 max-w-xl text-lg text-mist">{c["cta.body"]}</p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/book">{c["hero.primaryCta"]}</ButtonLink>
            {ig && (
              <a
                href={ig}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-3 rounded-full border border-foam/40 px-7 py-4 text-[12px] font-semibold tracking-[0.16em] hover:border-foam"
              >
                <Instagram className="h-4 w-4" /> MESSAGE ON INSTAGRAM
              </a>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
