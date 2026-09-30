import type { Metadata } from "next";
import { ButtonLink } from "@/components/site/Buttons";
import { Img } from "@/components/site/Img";
import { PageHero, Prose } from "@/components/site/Section";
import { Testimonials } from "@/components/site/Testimonials";
import { getContent } from "@/lib/content";
import { db } from "@/lib/db";
import { getPublicServices, getReviewStats, getTestimonials } from "@/lib/public";

export const metadata: Metadata = {
  title: "About",
  description: "Ocean X films and photographs surfers at Machines, Maabaidhoo, in Laamu, Maldives.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const [c, services, testimonials, reviewStats] = await Promise.all([getContent(), getPublicServices(), getTestimonials(true), getReviewStats()]);
  const image = c["about.imageId"]
    ? await db.mediaAsset.findUnique({ where: { id: c["about.imageId"] }, select: { id: true, width: true, height: true, alt: true } })
    : null;

  return (
    <>
      <PageHero eyebrow="About Ocean X" title={c["about.title"]} />
      <section className="bg-paper py-20 md:py-28">
        <div className="container-x grid gap-14 lg:grid-cols-2 lg:gap-24">
          <div data-reveal>
            <Prose text={c["about.body"]} className="text-lg text-slate md:text-xl" />
            <div className="mt-10">
              <ButtonLink href="/work" variant="dark" arrow>
                SEE OUR WORK
              </ButtonLink>
            </div>
          </div>
          <div data-reveal>
            {image ? (
              <div className="aspect-[4/5] overflow-hidden bg-ink">
                <Img media={image} alt={image.alt || "Ocean X at Machines"} sizes="(min-width: 1024px) 50vw, 100vw" />
              </div>
            ) : (
              <div className="border-l border-deep/15 pl-8">
                <p className="eyebrow text-slate">What we do</p>
                <ul className="mt-6 space-y-4">
                  {services.map((s) => (
                    <li key={s.id} className="flex items-baseline justify-between gap-4 border-b border-deep/10 pb-4">
                      <span className="display text-2xl [font-stretch:110%]">{s.name}</span>
                      <span className="text-xs uppercase tracking-[0.18em] text-slate">{s.status === "ACTIVE" ? "Now" : "Soon"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>
      {testimonials.length > 0 && <Testimonials items={testimonials} stats={reviewStats} />}
    </>
  );
}
