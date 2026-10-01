import type { Metadata } from "next";
import { EmptyState, PageHero } from "@/components/site/Section";
import { Stars } from "@/components/site/Stars";
import { ReviewGrid } from "@/components/site/Testimonials";
import { getContent } from "@/lib/content";
import { getReviewStats, getShowcase, getTestimonials } from "@/lib/public";
import { ReviewForm } from "./ReviewForm";

export const metadata: Metadata = {
  title: "Reviews",
  description: "Reviews of Ocean X drone videography from surfers filmed at Machines, Maabaidhoo — and a place to leave your own.",
  alternates: { canonical: "/reviews" },
};

export default async function ReviewsPage() {
  const showcase = await getShowcase();
  const [c, reviews, stats] = await Promise.all([getContent(), getTestimonials(), getReviewStats()]);

  return (
    <>
      <PageHero eyebrow="Reviews" title="What surfers say." intro={c["reviews.intro"]} image={showcase[0]?.poster} />
      <section className="bg-paper py-16 md:py-24">
        <div className="container-x">
          {stats.average && (
            <div data-reveal className="mb-12 flex flex-wrap items-center gap-4 border-b border-deep/10 pb-10">
              <span className="display text-6xl [font-stretch:110%]">{stats.average.toFixed(1)}</span>
              <span>
                <Stars value={stats.average} size="h-6 w-6" className="text-deep" />
                <span className="mt-1 block text-sm text-slate">
                  from {stats.count} review{stats.count === 1 ? "" : "s"}
                </span>
              </span>
              <a href="#leave-a-review" className="ml-auto rounded-full bg-abyss px-7 py-4 text-[12px] font-semibold tracking-[0.16em] text-foam hover:bg-ink-2">
                LEAVE A REVIEW
              </a>
            </div>
          )}
          {reviews.length === 0 ? (
            <EmptyState title="No reviews yet" body="Had a drone videography session with us at Machines? Be the first to review it below." />
          ) : (
            <ReviewGrid items={reviews} />
          )}
        </div>
      </section>
      <section id="leave-a-review" className="scroll-mt-20 bg-foam py-20 md:py-28">
        <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-24">
          <div>
            <p className="eyebrow text-gold-deep">Leave a review</p>
            <h2 className="display mt-4 text-4xl [font-stretch:112%] sm:text-5xl">How was your drone videography?</h2>
            <p className="mt-5 max-w-md text-lg text-slate">
              Rate the drone videography of your session at Machines and leave a short note — the clips, the angles, the experience. No account needed.
            </p>
          </div>
          <ReviewForm thanks={c["reviews.thanks"]} />
        </div>
      </section>
    </>
  );
}
