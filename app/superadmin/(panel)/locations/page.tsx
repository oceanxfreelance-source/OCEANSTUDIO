import Link from "next/link";
import { Badge, ButtonLink, Empty, PageHeader, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { toggleLocation } from "./actions";

export const metadata = { title: "Laamu locations" };

export default async function LocationsAdmin() {
  await requireAdmin();
  const locations = await db.location.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }], include: { _count: { select: { portfolio: true } } } });
  return (
    <>
      <PageHeader title="Laamu locations" subtitle="Places shown on the Laamu page and in the booking form." actions={<ButtonLink href="/superadmin/locations/new">+ Add location</ButtonLink>} />
      {locations.length === 0 ? (
        <Empty>No locations yet.</Empty>
      ) : (
        <Table head={["Location", "Type", "Portfolio", "Visibility", "Featured"]}>
          {locations.map((l) => (
            <tr key={l.id} className="hover:bg-foam/40">
              <td className="px-4 py-3">
                <Link href={`/superadmin/locations/${l.id}`} className="flex items-center gap-3 font-medium hover:underline">
                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded bg-foam">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {l.coverId && <img src={`/media/${l.coverId}?size=thumb`} alt="" className="h-full w-full object-cover" />}
                  </span>
                  {l.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate">
                {l.kind} · {l.atoll}
              </td>
              <td className="px-4 py-3 text-slate">{l._count.portfolio}</td>
              <td className="px-4 py-3">
                <form action={toggleLocation.bind(null, l.id, "published")}>
                  <button title="Click to toggle">{l.published ? <Badge tone="green">Published</Badge> : <Badge>Draft</Badge>}</button>
                </form>
              </td>
              <td className="px-4 py-3">
                <form action={toggleLocation.bind(null, l.id, "featured")}>
                  <button title="Click to toggle">{l.featured ? <Badge tone="purple">★ Featured</Badge> : <Badge>☆</Badge>}</button>
                </form>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
