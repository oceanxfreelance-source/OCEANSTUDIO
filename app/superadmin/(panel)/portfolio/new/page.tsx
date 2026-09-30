import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { savePortfolioItem } from "../actions";
import { PortfolioForm } from "../PortfolioForm";

export const metadata = { title: "Add work" };

export default async function NewWork() {
  await requireAdmin();
  const locations = await db.location.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader title="Add work" back={{ href: "/superadmin/portfolio", label: "Portfolio" }} />
      <PortfolioForm action={savePortfolioItem.bind(null, null)} locations={locations} />
    </>
  );
}
