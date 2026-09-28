import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { LocalTime } from "@/components/ui/LocalTime";
import { downloadAnalytics } from "@/server/stats";

export const metadata = { title: "Downloads" };

export default async function DownloadsPage() {
  const a = await downloadAnalytics();
  return (
    <>
      <PageHeader eyebrow="Analytics" title="Downloads" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Downloads" value={a.total} />
        <Stat label="Last download" value={<span className="text-base">{a.lastDownloadAt ? <LocalTime iso={a.lastDownloadAt} relative /> : "—"}</span>} />
        <Stat label="Distinct files downloaded" value={a.mostDownloaded.length} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card title="Most downloaded">
          {a.mostDownloaded.length === 0 ? (
            <p className="text-sm text-mist-400">No client downloads yet.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {a.mostDownloaded.map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="truncate">{m.version?.filename ?? "—"}</span>
                  <span className="tabular text-mist-400">{m.count}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card title="Recent" padded={false}>
          {a.recent.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No downloads yet" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-mist-400">
                <tr className="border-b border-ink-700">
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-5 py-3 font-medium">Delivery</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">File version</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {a.recent.map((d) => (
                  <tr key={d.id}>
                    <td className="px-5 py-2.5 text-xs text-mist-400">
                      <LocalTime iso={d.createdAt} />
                    </td>
                    <td className="px-5 py-2.5">{d.delivery ? `${d.delivery.title} · ${d.delivery.client.name}` : "Admin"}</td>
                    <td className="px-5 py-2.5 text-xs text-mist-300">{d.downloadType.replace("_", " ")}</td>
                    <td className="px-5 py-2.5 text-xs text-mist-300">{d.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
