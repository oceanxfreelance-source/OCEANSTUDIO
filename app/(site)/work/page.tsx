import type { Metadata } from "next";
import Link from "next/link";
import { WorkCard } from "@/components/site/Cards";
import { EmptyState, PageHero } from "@/components/site/Section";
import { cx } from "@/components/ui/cx";
import { PORTFOLIO_CATEGORIES } from "@/lib/constants";
import { getContent } from "@/lib/content";
import { getPortfolio } from "@/lib/public";

export const metadata: Metadata = {
  title: "Our Work",
  description: "Surf films, drone videography and ocean photography from Machines, Maabaidhoo — Laamu, Maldives.",
  alternates: { canonical: "/work" },
};

type Props = { searchParams: Promise<{ category?: string }> };

export default async function WorkPage({ searchParams }: Props) {
  const { category } = await searchParams;
  const active = PORTFOLIO_CATEGORIES.find((c) => c.toLowerCase() === category?.toLowerCase());
  const [c, items] = await Promise.all([getContent(), getPortfolio(active)]);

  return (
    <>
      <PageHero eyebrow="Our work" title="Stories from the water." intro={c["work.intro"]} />
      <section className="bg-abyss pb-24 text-foam md:pb-32">
        <div className="container-x">
          <nav aria-label="Filter by category" className="-mx-5 flex gap-2 overflow-x-auto border-b border-white/10 px-5 pb-5 sm:mx-0 sm:flex-wrap sm:px-0">
            <FilterLink href="/work" active={!active}>
              All
            </FilterLink>
            {PORTFOLIO_CATEGORIES.map((cat) => (
              <FilterLink key={cat} href={`/work?category=${cat.toLowerCase()}`} active={active === cat}>
                {cat}
              </FilterLink>
            ))}
          </nav>
          <div className="mt-12">
            {items.length === 0 ? (
              <EmptyState dark title={active ? `No ${active.toLowerCase()} work yet` : "New work coming soon"} body="Follow along on Instagram for the latest sessions." />
            ) : (
              <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((w) => (
                  <WorkCard key={w.id} w={w} dark />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cx(
        "shrink-0 rounded-full border px-4 py-2 text-xs tracking-wide transition-colors",
        active ? "border-foam bg-foam text-abyss" : "border-white/15 text-foam/70 hover:border-white/40 hover:text-foam",
      )}
    >
      {children}
    </Link>
  );
}
