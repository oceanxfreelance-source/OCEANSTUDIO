import Link from "next/link";
import { ButtonLink } from "@/components/site/Buttons";
import { WorkCard } from "@/components/site/Cards";
import { HeroVideo } from "@/components/site/HeroVideo";
import { AnimatedWords } from "@/components/site/HeroTitle";
import { Viewfinder } from "@/components/site/Viewfinder";
import { ArrowRight } from "@/components/site/Icons";
import { Img } from "@/components/site/Img";
import { OceanBackdrop } from "@/components/site/OceanBackdrop";
import { SectionHeading } from "@/components/site/Section";
import { Testimonials } from "@/components/site/Testimonials";
import { getLatestClips } from "@/lib/clip-shop";
import { getContent } from "@/lib/content";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getFeaturedWork, getReviewStats, getShowcase, getTestimonials } from "@/lib/public";
import { shopConfigFrom } from "@/lib/shop";
import { SLOT_LABEL } from "@/lib/shop-rules";
import { parseVideoUrl, posterFor } from "@/lib/video";

/**
 * Home: everything points to the two things a surfer comes for —
 *   "I surfed → find my clips"   and   "I want to be filmed → book a session".
 */
export default async function HomePage() {
  const [c, work, testimonials, reviewStats, showcase, latest] = await Promise.all([
    getContent(),
    getFeaturedWork(3),
    getTestimonials(true),
    getReviewStats(),
    getShowcase(),
    getLatestClips(10),
  ]);
  const cfg = shopConfigFrom(c);
  const heroImage = c["hero.imageId"]
    ? await db.mediaAsset.findUnique({ where: { id: c["hero.imageId"] }, select: { id: true, width: true, height: true, alt: true } })
    : null;
  const heroVideo = parseVideoUrl(c["hero.videoUrl"]);
  // No hero photo or video chosen yet: open with Ocean X's own drone footage.
  const reel = !heroImage && heroVideo?.kind !== "file" ? showcase[0] : undefined;
  const prices = [
    { name: "One clip", price: cfg.prices.clip, note: "Any clip of you from the gallery" },
    { name: "Full session", price: cfg.prices.session, note: "Every clip of you in one session", best: true },
    { name: "Session + reel", price: cfg.prices.reel, note: "All clips + a 30–60 s edit with music" },
  ];

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="grain relative flex min-h-[100svh] items-end overflow-hidden bg-abyss text-foam">
        <div className="hero-parallax absolute inset-0">
          <div className="hero-media absolute inset-0">
            {heroImage ? (
              <Img media={heroImage} alt={heroImage.alt || "Ocean X — Machines, Maabaidhoo"} priority sizes="100vw" />
            ) : heroVideo?.kind === "file" && posterFor(heroVideo.url) ? (
              // No hero photo: use the hero video's cover frame (also what phones see).
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterFor(heroVideo.url)!} alt="Ocean X — Machines, Maabaidhoo" fetchPriority="high" className="h-full w-full object-cover" />
            ) : reel ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={reel.poster!} alt="Surfing Machines, filmed from the drone" fetchPriority="high" className="h-full w-full object-cover" />
            ) : (
              <OceanBackdrop />
            )}
            {reel && <HeroVideo src={reel.video} poster={reel.poster ?? undefined} mobile />}
            {heroVideo?.kind === "file" && <HeroVideo src={heroVideo.url} poster={heroImage ? `/media/${heroImage.id}` : (posterFor(heroVideo.url) ?? undefined)} />}
          </div>
        </div>
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-abyss via-abyss/30 to-abyss/40" />
        <Viewfinder />
        <span aria-hidden className="letterbox letterbox-top" />
        <span aria-hidden className="letterbox letterbox-bottom" />

        <div className="hero-content-scroll container-x relative z-[2] pb-10 pt-32 md:pb-16 md:pt-48">
          <p className="hero-in eyebrow eyebrow-line w-fit text-foam/80" style={{ "--delay": "0.15s" } as React.CSSProperties}>
            {c["hero.location"]}
          </p>
          <h1 className="display mt-5 max-w-[14ch] text-[clamp(2.8rem,10vw,8.5rem)] [font-stretch:118%]">
            <AnimatedWords text={c["hero.title"]} />
          </h1>
          <p className="hero-in mt-5 max-w-md text-base leading-relaxed text-foam/80 md:text-lg" style={{ "--delay": "0.8s" } as React.CSSProperties}>
            {c["hero.subtitle"]}
          </p>

          {/* The two choices */}
          <div className="hero-in mt-8 grid gap-3 md:mt-12 md:max-w-4xl md:grid-cols-2" style={{ "--delay": "1s" } as React.CSSProperties}>
            <Link href="/clips" className="group flex items-center gap-4 rounded-2xl bg-gold p-5 text-abyss transition-transform duration-300 hover:-translate-y-0.5 md:p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-abyss/10" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              </span>
              <span className="flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">Surfed with us?</span>
                <span className="block text-xl font-semibold">{c["hero.primaryCta"].charAt(0) + c["hero.primaryCta"].slice(1).toLowerCase()}</span>
                <span className="block text-sm opacity-75">Clips online the same day · from ${cfg.prices.clip}</span>
              </span>
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/book" className="group flex items-center gap-4 rounded-2xl border border-foam/25 bg-abyss/40 p-5 text-foam backdrop-blur-md transition-transform duration-300 hover:-translate-y-0.5 md:p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-foam/10" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
              </span>
              <span className="flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">Want to be filmed?</span>
                <span className="block text-xl font-semibold">{c["hero.secondaryCta"].charAt(0) + c["hero.secondaryCta"].slice(1).toLowerCase()}</span>
                <span className="block text-sm text-foam/70">Pick a day — we film every wave</span>
              </span>
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Latest clips (proof that it's live) ─────────────── */}
      {latest.length > 0 && (
        <section className="bg-abyss pb-16 pt-14 text-foam md:pb-24">
          <div className="container-x flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-gold">Just uploaded</p>
              <h2 className="display mt-3 text-3xl [font-stretch:112%] md:text-5xl">Is this you?</h2>
            </div>
            <Link href="/clips" className="link-underline shrink-0 text-sm text-foam/80">
              See all clips →
            </Link>
          </div>
          <ul className="no-scrollbar container-x mt-8 flex snap-x gap-3 overflow-x-auto pb-2">
            {latest.map((clip) => (
              <li key={clip.id} className="w-36 shrink-0 snap-start md:w-48">
                <Link href={`/clips?date=${clip.date.toISOString().slice(0, 10)}&slot=${clip.slot}`} className="group block">
                  <span className="block aspect-[4/5] overflow-hidden rounded-xl bg-ink">
                    {clip.posterUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={clip.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                    )}
                  </span>
                  <span className="mt-2 block text-xs text-mist">
                    {SLOT_LABEL[clip.slot]} · {formatDate(clip.date, { day: "numeric", month: "short" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── How it works ──────────────────────────────────── */}
      <section className="bg-paper py-20 md:py-28">
        <div className="container-x">
          <SectionHeading eyebrow="How it works" title="Surf. We film. You keep the clips." />
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { n: "1", t: "Surf", d: "Book a session and tell us how to spot you — or just paddle out. We film the line-up every session." },
              { n: "2", t: "We film every wave", d: "From the boat, the channel and (with a permit) the drone above Machines." },
              { n: "3", t: "Find yourself, download", d: "Clips go online the same day. Tap to preview, buy, and save the full-quality video to your phone." },
            ].map((step) => (
              <li key={step.n} data-reveal className="flex gap-5 rounded-2xl border border-deep/10 bg-white/60 p-6">
                <span className="display flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-abyss text-lg text-gold">{step.n}</span>
                <span>
                  <span className="block text-lg font-medium">{step.t}</span>
                  <span className="mt-1 block text-slate">{step.d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Prices ────────────────────────────────────────── */}
      <section className="bg-foam py-20 md:py-28">
        <div className="container-x">
          <SectionHeading eyebrow="Prices" title="Simple prices, in USD." intro={`Pay cash on the island${cfg.bankDetails ? " or by bank transfer" : ""}. Several clips from one session never cost more than the full session.`} />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {prices.map((p) => (
              <div key={p.name} data-reveal className={p.best ? "rounded-2xl bg-abyss p-7 text-foam" : "rounded-2xl border border-deep/10 bg-white/70 p-7"}>
                <p className={p.best ? "eyebrow text-gold" : "eyebrow text-slate"}>{p.best ? "Most popular" : "\u00a0"}</p>
                <p className="mt-3 text-lg font-medium">{p.name}</p>
                <p className="display mt-2 text-5xl">${p.price}</p>
                <p className={p.best ? "mt-3 text-sm text-mist" : "mt-3 text-sm text-slate"}>{p.note}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/clips" variant="dark" arrow>
              FIND MY CLIPS
            </ButtonLink>
            <ButtonLink href="/book" variant="outline-dark">
              BOOK A SESSION
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* ── Our work ──────────────────────────────────────── */}
      {work.length > 0 && (
        <section className="bg-abyss py-20 text-foam md:py-28">
          <div className="container-x">
            <SectionHeading
              dark
              eyebrow="Our work"
              title="Films from Machines"
              action={
                <ButtonLink href="/work" variant="outline-light" arrow className="self-start md:self-auto">
                  ALL FILMS
                </ButtonLink>
              }
            />
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {work.map((w) => (
                <WorkCard key={w.id} w={w} dark />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Reviews ───────────────────────────────────────── */}
      {testimonials.length > 0 ? (
        <Testimonials items={testimonials} stats={reviewStats} />
      ) : (
        <section className="bg-paper py-16">
          <div className="container-x flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <p className="display text-2xl [font-stretch:110%] md:text-3xl">{c["cta.title"]}</p>
            <ButtonLink href="/reviews#leave-a-review" variant="outline-dark">
              LEAVE A REVIEW
            </ButtonLink>
          </div>
        </section>
      )}
    </>
  );
}
