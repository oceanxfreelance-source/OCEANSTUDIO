import Link from "next/link";
import { Badge, ButtonLink, Empty, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Testimonials" };

export default async function TestimonialsAdmin() {
  await requireAdmin();
  const items = await db.testimonial.findMany({ orderBy: [{ featured: "desc" }, { createdAt: "desc" }] });
  return (
    <>
      <PageHeader title="Testimonials" subtitle="Featured testimonials appear on the home page; all published ones on About." actions={<ButtonLink href="/superadmin/testimonials/new">+ Add testimonial</ButtonLink>} />
      {items.length === 0 ? (
        <Empty>No testimonials yet. The section stays hidden on the website until you add one.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((t) => (
            <Link key={t.id} href={`/superadmin/testimonials/${t.id}`} className="rounded-xl border border-slate/15 bg-white p-5 hover:border-slate/40">
              <p className="line-clamp-3 text-sm">“{t.text}”</p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {t.name}
                  <span className="font-normal text-slate">{t.instagram ? ` · @${t.instagram}` : ""}{t.date ? ` · ${formatDate(t.date)}` : ""}</span>
                </span>
                <span className="flex gap-1">
                  {t.featured && <Badge tone="purple">Featured</Badge>}
                  {t.published ? <Badge tone="green">Published</Badge> : <Badge>Hidden</Badge>}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
