import Link from "next/link";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { LocalTime } from "@/components/ui/LocalTime";
import { db } from "@/lib/db";
import { displayStatus } from "@/server/deliveries";

export const metadata = { title: "Deliveries" };

export default async function DeliveriesPage() {
  const deliveries = await db.delivery.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { client: { select: { name: true } }, project: { select: { id: true, name: true } }, _count: { select: { files: true, downloads: true, favorites: true } } },
  });
  return (
    <>
      <PageHeader eyebrow="Private galleries · 48 hours" title="Deliveries" />
      {deliveries.length === 0 ? (
        <EmptyState title="No deliveries yet">Open a project, publish versions and create a client delivery.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-ink-700">
          <table className="w-full text-sm">
            <thead className="bg-ink-850 text-left text-xs text-mist-400">
              <tr>
                <th className="px-5 py-3 font-medium">Delivery</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 font-medium">Expires</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Files</th>
                <th className="px-5 py-3 font-medium">Downloads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {deliveries.map((d) => (
                <tr key={d.id} className="hover:bg-ink-850">
                  <td className="px-5 py-3">
                    <Link href={`/admin/deliveries/${d.id}`} className="font-medium hover:text-ocean-300">
                      #{String(d.number).padStart(3, "0")} · {d.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-mist-300">{d.client.name}</td>
                  <td className="px-5 py-3 text-mist-300">{d.project.name}</td>
                  <td className="px-5 py-3 text-mist-300">
                    <LocalTime iso={d.createdAt} />
                  </td>
                  <td className="px-5 py-3 text-mist-300">
                    <LocalTime iso={d.expiresAt} />
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={displayStatus(d)} />
                  </td>
                  <td className="tabular px-5 py-3">{d._count.files}</td>
                  <td className="tabular px-5 py-3">{d._count.downloads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
