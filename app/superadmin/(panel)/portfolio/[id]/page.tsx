import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { deletePortfolioItem, savePortfolioItem } from "../actions";
import { PortfolioForm } from "../PortfolioForm";

export const metadata = { title: "Edit work" };

export default async function EditWork({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [item, locations] = await Promise.all([
    db.portfolioItem.findUnique({ where: { id }, include: { images: { orderBy: { position: "asc" } } } }),
    db.location.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!item) notFound();
  const { created } = await searchParams;
  return (
    <>
      <PageHeader
        title={item.title}
        back={{ href: "/superadmin/portfolio", label: "Portfolio" }}
        actions={
          <>
            {item.published && (
              <Link href={`/work/${item.slug}`} target="_blank" className="rounded-lg border border-slate/30 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-foam">
                View on website ↗
              </Link>
            )}
            <ConfirmButton action={deletePortfolioItem.bind(null, item.id)} confirm={`Delete "${item.title}" from the portfolio?`}>
              Delete
            </ConfirmButton>
          </>
        }
      />
      {created && <p className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Added to the portfolio.</p>}
      <PortfolioForm action={savePortfolioItem.bind(null, item.id)} item={item} locations={locations} />
    </>
  );
}
