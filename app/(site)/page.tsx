import Link from "next/link";
import { ButtonLink } from "@/components/site/Buttons";
import { LocationCard, ServiceCard, WorkCard } from "@/components/site/Cards";
import { HeroVideo } from "@/components/site/HeroVideo";
import { AnimatedWords } from "@/components/site/HeroTitle";
import { Marquee } from "@/components/site/Marquee";
import { ArrowRight, Instagram } from "@/components/site/Icons";
import { Img } from "@/components/site/Img";
import { OceanBackdrop } from "@/components/site/OceanBackdrop";
import { Prose, SectionHeading } from "@/components/site/Section";
import { Testimonials } from "@/components/site/Testimonials";
import { getContent } from "@/lib/content";
import { db } from "@/lib/db";
import { instagramDmUrl, instagramUrl } from "@/lib/format";
import { InstagramBookButton } from "@/components/site/InstagramBook";
import { getFeaturedWork, getLocations, getPublicServices, getReviewStats, getTestimonials } from "@/lib/public";
import { parseVideoUrl } from "@/lib/video";

export default async function HomePage() {
  const [c, services, work, locations, testimonials, reviewStats] = await Promise.all([
    getContent(),
    getPublicServices(),
    getFeaturedWork(5),
    getLocations(),
    getTestimonials(true),
    getReviewStats(),
  ]);
  const heroImage = c["hero.imageId"]
    ? await db.mediaAsset.findUnique({ where: { id: c["hero.imageId"] }, select: { id: true, width: true, height: true, alt: true } })
    : null;
  const heroVideo = parseVideoUrl(c["hero.videoUrl"]);
  const ig = instagramUrl(c["social.instagram"]);
  const dm = instagramDmUrl(c["social.instagram"]);
  const [lead, ...rest] = work;

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative flex min-h-[100svh] items-end overflow-hidden bg-abyss text-foam">
        <div className="hero-parallax absolute inset-0">
          <div className="hero-media absolute inset-0">
            {heroImage ? <Img media={heroImage} alt={heroImage.alt || "Ocean X — Machines, Maabaidhoo"} priority sizes="100vw" /> : <OceanBackdrop />}
            {heroVideo?.kind === "file" && <HeroVideo src={heroVideo.url} poster={heroImage ? `/media/${heroImage.id}` : undefined} />}
          </div>
        </div>
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-abyss via-abyss/30 to-abyss/40" />

        <div className="hero-content-scroll container-x relative pb-20 pt-32 md:pb-28">
          <p className="hero-in eyebrow eyebrow-line text-foam/80" style={{ "--delay": "0.15s" } as React.CSSProperties}>
            {c["hero.location"]}
          </p>
          <h1 className="display mt-6 max-w-[14ch] text-[clamp(3rem,11vw,9.5rem)] [font-stretch:118%]">
            <AnimatedWords text={c["hero.title"]} />
          </h1>
          <div className="mt-8 flex flex-col gap-8 md:mt-10 md:flex-row md:items-end md:justify-between">
            <p className="hero-in max-w-md text-lg leading-relaxed text-foam/80 md:text-xl" style={{ "--delay": "0.85s" } as React.CSSProperties}>
              {c["hero.subtitle"]}
            </p>
            <div className="hero-in flex flex-col gap-3 sm:flex-row" style={{ "--delay": "1.05s" } as React.CSSProperties}>
              <ButtonLink href="/work" variant="light">
                {c["hero.primaryCta"]}
              </ButtonLink>
              <ButtonLink href="/reviews" variant="outline-light" arrow>
                {c["hero.secondaryCta"]}
              </ButtonLink>
            </div>
          </div>
        </div>
        <div className="hero-in absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 text-foam/50 md:flex" style={{ "--delay": "1.6s" } as React.CSSProperties} aria-hidden>
          <span className="text-[10px] uppercase tracking-[0.35em]">Scroll</span>
          <span className="scroll-cue h-10" />
        </div>
      </section>

      <Marquee items={["Machines", "Surf films", "Maabaidhoo", "Drone videography", "Laamu", "Surf photography"]} />

      {/* ── Intro ─────────────────────────────────────────── */}
      <section className="bg-paper py-24 md:py-36">
        <div className="container-x grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-24">
          <div data-reveal>
            <p className="eyebrow eyebrow-line text-gold-deep">Ocean X</p>
            <h2 className="display mt-5 text-4xl [font-stretch:112%] sm:text-5xl lg:text-6xl">{c["home.introTitle"]}</h2>
          </div>
          <div data-reveal className="lg:pt-10">
            <Prose text={c["home.introBody"]} className="text-lg text-slate" />
            {services.length > 0 && (
              <ul className="mt-10 divide-y divide-deep/10 border-y border-deep/10">
                {services.map((s) => (
                  <li key={s.id}>
                    <Link href={`/services/${s.slug}`} className="group flex items-center justify-between py-4 transition-[padding] duration-300 hover:px-2">
                      <span className="font-medium">{s.name}</span>
                      <span className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate">
                        {s.status === "ACTIVE" ? <span className="text-gold-deep">Available</span> : "Coming soon"}
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
            <SectionHeading eyebrow="Services" title="Surf sessions" intro={c["services.intro"]} />
            <div className="mt-14 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {services.slice(0, 6).map((s, i) => (
                <ServiceCard key={s.id} s={s} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Machines & Maabaidhoo ─────────────────────────────────────────── */}
      <section className="bg-ink py-24 text-foam md:py-32">
        <div className="container-x">
          <SectionHeading
            dark
            eyebrow="Machines • Maabaidhoo"
            title="Home waters."
            intro={c["laamu.intro"]}
            action={
              <ButtonLink href="/machines" variant="outline-light" arrow className="self-start md:self-auto">
                WHERE WE WORK
              </ButtonLink>
            }
          />
          {locations.length > 0 && (
            <div className="-mx-5 mt-14 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
              {locations.slice(0, 4).map((l) => (
                <div key={l.id} className="w-[80vw] shrink-0 snap-start sm:w-auto">
                  <LocationCard l={l} wide />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Reviews ───────────────────────────────────────── */}
      {testimonials.length > 0 && <Testimonials items={testimonials} stats={reviewStats} />}

      {/* ── Book via Instagram (shown once the Instagram username is set) ── */}
      {dm && (
        <section className="bg-ink py-24 text-foam md:py-32">
          <div className="container-x flex flex-col items-start justify-between gap-10 md:flex-row md:items-end" data-reveal>
            <div className="max-w-2xl">
              <p className="eyebrow eyebrow-line text-gold">Book a session</p>
              <h2 className="display mt-5 text-4xl [font-stretch:112%] sm:text-5xl lg:text-6xl">{c["book.title"]}</h2>
              <p className="mt-5 text-lg text-mist">{c["book.body"]}</p>
            </div>
            <InstagramBookButton dmUrl={dm} label="DM US TO BOOK" />
          </div>
        </section>
      )}

      {/* ── Call to action ────────────────────────────────── */}
      <section className="relative overflow-hidden bg-abyss py-28 text-foam md:py-40">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_80%_at_80%_100%,rgba(201,169,110,0.16),transparent_70%)]" />
        <div className="container-x relative" data-reveal>
          <p className="eyebrow text-gold">Reviews</p>
          <h2 className="display mt-5 max-w-4xl text-5xl [font-stretch:115%] sm:text-6xl lg:text-7xl">{c["cta.title"]}</h2>
          <p className="mt-6 max-w-xl text-lg text-mist">{c["cta.body"]}</p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/reviews#leave-a-review">LEAVE A REVIEW</ButtonLink>
            {ig && (
              <a
                href={ig}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-3 rounded-full border border-foam/40 px-7 py-4 text-[12px] font-semibold tracking-[0.16em] hover:border-foam"
              >
                <Instagram className="h-4 w-4" /> FOLLOW ON INSTAGRAM
              </a>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
