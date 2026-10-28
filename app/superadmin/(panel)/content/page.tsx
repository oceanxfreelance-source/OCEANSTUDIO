import { ContentGroupForm } from "@/components/admin/ContentGroupForm";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { CONTENT_FIELDS, getContent } from "@/lib/content";

export const metadata = { title: "Website content" };

export default async function ContentAdmin() {
  await requireAdmin();
  const c = await getContent();
  // Clip-shop settings have their own page (Prices & payment).
  const groups = [...new Set(CONTENT_FIELDS.map((f) => f.group))].filter((g) => !g.startsWith("Clip shop"));

  return (
    <>
      <PageHeader title="Website content" subtitle="Edit the text and images on the public website. Each section saves separately. Prices are under Clip shop → Prices & payment." />
      <div className="mb-6 flex flex-wrap gap-2">
        {groups.map((g) => (
          <a key={g} href={`#${encodeURIComponent(g)}`} className="rounded-full border border-slate/25 bg-white px-3 py-1 text-xs hover:bg-foam">
            {g}
          </a>
        ))}
      </div>
      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g} id={encodeURIComponent(g)} className="scroll-mt-20">
            <ContentGroupForm group={g} c={c} />
          </div>
        ))}
      </div>
    </>
  );
}
