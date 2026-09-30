import Link from "next/link";
import { Badge, ButtonLink, Empty, PageHeader } from "@/components/admin/ui";
import { cx } from "@/components/ui/cx";
import { requireAdmin } from "@/lib/auth";
import { PORTFOLIO_CATEGORIES } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { togglePortfolio } from "./actions";

export const metadata = { title: "Portfolio" };

export default async function PortfolioAdmin({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  await requireAdmin();
  const { category } = await searchParams;
  const cat = PORTFOLIO_CATEGORIES.find((c) => c === category);
  const items = await db.portfolioItem.findMany({
    where: cat ? { category: cat } : {},
    orderBy: [{ createdAt: "desc" }],
    include: { location: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader title="Portfolio" subtitle="Your work on the Our Work page." actions={<ButtonLink href="/superadmin/portfolio/new">+ Add work</ButtonLink>} />
      <div className="mb-5 flex flex-wrap gap-2">
        {[undefined, ...PORTFOLIO_CATEGORIES].map((c) => (
          <Link key={c ?? "all"} href={c ? `/superadmin/portfolio?category=${c}` : "/superadmin/portfolio"} className={cx("rounded-full border px-3 py-1 text-xs", cat === c ? "border-abyss bg-abyss text-white" : "border-slate/25 bg-white hover:bg-foam")}>
            {c ?? "All"}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <Empty>
          No work here yet. <Link href="/superadmin/portfolio/new" className="text-sea-deep underline">Add your first piece</Link>.
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((w) => (
            <div key={w.id} className="overflow-hidden rounded-xl border border-slate/15 bg-white">
              <Link href={`/superadmin/portfolio/${w.id}`} className="block aspect-[4/3] bg-foam">
                {w.coverId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/media/${w.coverId}?size=thumb`} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-full items-center justify-center text-xs text-slate">No cover image</span>
                )}
              </Link>
              <div className="p-4">
                <Link href={`/superadmin/portfolio/${w.id}`} className="font-medium hover:underline">
                  {w.title}
                </Link>
                <p className="mt-0.5 text-xs text-slate">
                  {w.category}
                  {w.location ? ` · ${w.location.name}` : ""}
                  {w.date ? ` · ${formatDate(w.date)}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <form action={togglePortfolio.bind(null, w.id, "published")}>
                    <button title="Click to toggle">{w.published ? <Badge tone="green">Published</Badge> : <Badge>Draft</Badge>}</button>
                  </form>
                  <form action={togglePortfolio.bind(null, w.id, "featured")}>
                    <button title="Click to toggle">{w.featured ? <Badge tone="purple">★ Featured</Badge> : <Badge>☆ Feature</Badge>}</button>
                  </form>
                  {w.videoUrl && <Badge tone="blue">Video</Badge>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
