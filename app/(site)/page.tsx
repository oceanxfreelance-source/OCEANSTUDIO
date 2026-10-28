import Link from "next/link";
import { HeroVideo } from "@/components/site/HeroVideo";
import { AnimatedWords } from "@/components/site/HeroTitle";
import { Viewfinder } from "@/components/site/Viewfinder";
import { ArrowRight } from "@/components/site/Icons";
import { Img } from "@/components/site/Img";
import { OceanBackdrop } from "@/components/site/OceanBackdrop";
import { getContent } from "@/lib/content";
import { db } from "@/lib/db";
import { getShowcase, getTestimonials } from "@/lib/public";
import { Stars } from "@/components/site/Stars";
import { shopConfigFrom } from "@/lib/shop";
import { parseVideoUrl, posterFor } from "@/lib/video";

/**
 * Home is deliberately calm: one screen with the two things a surfer comes
 * for, one short "how it works", and nothing else. Everything else is in the menu.
 */
export default async function HomePage() {
  const [c, showcase, featured] = await Promise.all([getContent(), getShowcase(), getTestimonials(true)]);
  const review = featured[0];
  const cfg = shopConfigFrom(c);
  const heroImage = c["hero.imageId"]
    ? await db.mediaAsset.findUnique({ where: { id: c["hero.imageId"] }, select: { id: true, width: true, height: true, alt: true } })
    : null;
  const heroVideo = parseVideoUrl(c["hero.videoUrl"]);
  // No hero photo or video chosen yet: open with Ocean X's own drone footage.
  const reel = !heroImage && heroVideo?.kind !== "file" ? showcase[0] : undefined;

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

        <div className="hero-content-scroll container-x relative z-[2] pb-12 pt-32 md:pb-20 md:pt-48">
          <h1 className="display max-w-[14ch] text-[clamp(2.8rem,10vw,8rem)] [font-stretch:118%]">
            <AnimatedWords text={c["hero.title"]} />
          </h1>
          <p className="hero-in mt-4 text-base text-foam/75 md:text-lg" style={{ "--delay": "0.7s" } as React.CSSProperties}>
            Surf filming at Machines, Maldives.
          </p>

          <div className="hero-in mt-10 grid max-w-3xl gap-3 sm:grid-cols-2" style={{ "--delay": "0.95s" } as React.CSSProperties}>
            <Link href="/clips" className="group flex items-center justify-between gap-4 rounded-2xl bg-gold px-6 py-5 text-abyss transition-transform duration-300 hover:-translate-y-0.5">
              <span>
                <span className="block text-xl font-semibold">Find my clips</span>
                <span className="block text-sm opacity-75">I surfed with you</span>
              </span>
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/book" className="group flex items-center justify-between gap-4 rounded-2xl border border-foam/30 bg-abyss/30 px-6 py-5 text-foam backdrop-blur-md transition-transform duration-300 hover:-translate-y-0.5">
              <span>
                <span className="block text-xl font-semibold">Book a session</span>
                <span className="block text-sm text-foam/70">Film me next time</span>
              </span>
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works: three short lines and the price. That's all. ── */}
      <section className="bg-paper py-20 md:py-28">
        <div className="container-x max-w-3xl">
          <h2 className="display text-3xl [font-stretch:112%] md:text-5xl">How it works</h2>
          <ol className="mt-10 space-y-7">
            {[
              ["We film you surfing", "From the boat and the drone, every session."],
              ["Find your clips the same day", "Tap a clip to preview it."],
              ["Buy and download", "Full quality, straight to your phone."],
            ].map(([t, d], i) => (
              <li key={t} data-reveal className="flex items-start gap-5">
                <span className="display flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-abyss text-gold">{i + 1}</span>
                <span>
                  <span className="block text-xl font-medium">{t}</span>
                  <span className="block text-slate">{d}</span>
                </span>
              </li>
            ))}
          </ol>
          <p data-reveal className="mt-12 border-t border-deep/10 pt-8 text-lg">
            <span className="font-semibold">${cfg.prices.clip}</span> a clip · <span className="font-semibold">${cfg.prices.session}</span> for your whole session
          </p>
          {review && (
            <figure data-reveal className="mt-12">
              {review.rating && <Stars value={review.rating} className="text-gold-deep" />}
              <blockquote className="mt-3 text-lg italic text-deep/80">“{review.text.length > 180 ? `${review.text.slice(0, 177)}…` : review.text}”</blockquote>
              <figcaption className="mt-2 text-sm text-slate">
                — {review.name} ·{" "}
                <Link href="/reviews" className="underline">
                  more reviews
                </Link>
              </figcaption>
            </figure>
          )}
        </div>
      </section>
    </>
  );
}
