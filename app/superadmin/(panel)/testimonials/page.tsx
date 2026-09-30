import Link from "next/link";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { StarsInline } from "@/components/admin/StarsInline";
import { Badge, ButtonLink, Empty, PageHeader } from "@/components/admin/ui";
import { cx } from "@/components/ui/cx";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { deleteTestimonial, setReviewVisibility, toggleReviewFeatured } from "./actions";

export const metadata = { title: "Reviews" };

export default async function ReviewsAdmin() {
  await requireAdmin();
  const items = await db.testimonial.findMany({ orderBy: [{ pending: "desc" }, { createdAt: "desc" }] });
  const pending = items.filter((t) => t.pending);
  const rest = items.filter((t) => !t.pending);
  const published = rest.filter((t) => t.published);
  const avg = published.filter((t) => t.rating).reduce((sum, t, _, arr) => sum + (t.rating ?? 0) / arr.length, 0);

  return (
    <>
      <PageHeader
        title="Reviews"
        subtitle={`Guests leave reviews on the website's Reviews page. New reviews wait here until you approve them.${published.length ? ` ${published.length} published · average ${avg ? avg.toFixed(1) : "—"} ★` : ""}`}
        actions={<ButtonLink href="/superadmin/testimonials/new">+ Add review</ButtonLink>}
      />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate">Waiting for approval ({pending.length})</h2>
      {pending.length === 0 ? (
        <Empty>No new reviews waiting.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pending.map((t) => (
            <ReviewCard key={t.id} t={t} highlight />
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wider text-slate">All reviews ({rest.length})</h2>
      {rest.length === 0 ? (
        <Empty>No reviews yet.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rest.map((t) => (
            <ReviewCard key={t.id} t={t} />
          ))}
        </div>
      )}
    </>
  );
}

type Review = { id: string; name: string; instagram: string | null; text: string; rating: number | null; source: string; published: boolean; featured: boolean; pending: boolean; createdAt: Date; date: Date | null };

function ReviewCard({ t, highlight = false }: { t: Review; highlight?: boolean }) {
  return (
    <div className={cx("flex flex-col justify-between rounded-xl border bg-white p-5", highlight ? "border-sea-deep/40 ring-2 ring-sea/20" : "border-slate/15")}>
      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="font-medium">
            {t.name}
            {t.instagram && <span className="font-normal text-slate"> · @{t.instagram}</span>}
          </p>
          {t.rating ? <StarsInline value={t.rating} /> : <span className="text-xs text-slate">no stars</span>}
        </div>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">“{t.text}”</p>
        <p className="mt-2 text-xs text-slate">
          {t.source === "guest" ? "From the website" : "Added by admin"} · {formatDate(t.date ?? t.createdAt)}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate/10 pt-4">
        {t.pending ? (
          <>
            <form action={setReviewVisibility.bind(null, t.id, true)}>
              <button className="rounded-lg bg-abyss px-4 py-2 text-sm font-semibold text-white hover:bg-ink-3">Approve</button>
            </form>
            <form action={setReviewVisibility.bind(null, t.id, false)}>
              <button className="rounded-lg border border-slate/30 bg-white px-4 py-2 text-sm hover:bg-foam">Hide</button>
            </form>
          </>
        ) : (
          <>
            {t.published ? <Badge tone="green">On website</Badge> : <Badge>Hidden</Badge>}
            <form action={setReviewVisibility.bind(null, t.id, !t.published)}>
              <button className="rounded-md border border-slate/25 px-2 py-1 text-xs hover:bg-foam">{t.published ? "Hide" : "Show"}</button>
            </form>
            <form action={toggleReviewFeatured.bind(null, t.id)}>
              <button className="rounded-md border border-slate/25 px-2 py-1 text-xs hover:bg-foam" title="Featured reviews appear on the home page">
                {t.featured ? "★ Featured" : "☆ Feature on home"}
              </button>
            </form>
          </>
        )}
        <Link href={`/superadmin/testimonials/${t.id}`} className="ml-auto text-xs text-slate underline hover:text-deep">
          Edit
        </Link>
        <ConfirmButton action={deleteTestimonial.bind(null, t.id, false)} confirm={`Delete the review from ${t.name}?`} className="text-xs text-red-700 underline disabled:opacity-60">
          Delete
        </ConfirmButton>
      </div>
    </div>
  );
}
