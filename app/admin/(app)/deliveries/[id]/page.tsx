import Link from "next/link";
import { notFound } from "next/navigation";
import { DeliveryActions } from "@/components/admin/DeliveryActions";
import { Alert, Card, PageHeader, QualityLabel, Stat, StatusBadge } from "@/components/ui";
import { LocalTime } from "@/components/ui/LocalTime";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/labels";
import { displayStatus } from "@/server/deliveries";

export default async function DeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await db.delivery.findUnique({
    where: { id },
    include: {
      client: true,
      project: { select: { id: true, name: true } },
      files: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { downloads: true, favorites: true } } } },
      packages: { orderBy: { partNumber: "asc" } },
      downloads: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { downloads: true, favorites: true } },
    },
  });
  if (!d) notFound();
  const status = displayStatus(d);
  const renewedFrom = d.renewedFromId ? await db.delivery.findUnique({ where: { id: d.renewedFromId }, select: { id: true, number: true } }) : null;
  return (
    <>
      <PageHeader eyebrow={`Delivery #${String(d.number).padStart(3, "0")}`} title={d.title}>
        <StatusBadge status={status} />
      </PageHeader>
      <div className="mb-6">
        <DeliveryActions id={d.id} status={status} />
      </div>
      {d.lastCleanupError && (
        <div className="mb-6">
          <Alert tone="warn" title={`Cleanup retrying (attempt ${d.cleanupAttempts})`}>
            {d.lastCleanupError}
          </Alert>
        </div>
      )}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Stat label="Client" value={<span className="text-lg">{d.client.name}</span>} />
        <Stat label="Created" value={<span className="text-base"><LocalTime iso={d.createdAt} /></span>} />
        <Stat label="Expires" value={<span className="text-base"><LocalTime iso={d.expiresAt} /></span>} sub={<LocalTime iso={d.expiresAt} relative />} />
        <Stat label="Files" value={d.files.length} sub={formatBytes(d.files.reduce((a, f) => a + Number(f.size), 0))} />
        <Stat label="Downloads" value={d._count.downloads} sub={d.downloads[0] ? <>last <LocalTime iso={d.downloads[0].createdAt} relative /></> : "none yet"} />
        <Stat label="Client favorites" value={d._count.favorites} />
      </div>
      <p className="mb-6 text-xs text-mist-400">
        Project <Link className="text-ocean-300 hover:underline" href={`/admin/projects/${d.project.id}`}>{d.project.name}</Link>
        {renewedFrom && (
          <>
            {" "}· renewed from <Link className="text-ocean-300 hover:underline" href={`/admin/deliveries/${renewedFrom.id}`}>#{String(renewedFrom.number).padStart(3, "0")}</Link>
          </>
        )}
        {d.deletedAt && <> · temporary files deleted <LocalTime iso={d.deletedAt} /> (masters untouched)</>}
      </p>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card title="Manifest" padded={false}>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-mist-400">
              <tr className="border-b border-ink-700">
                <th className="px-5 py-3 font-medium">File</th>
                <th className="px-5 py-3 font-medium">Quality</th>
                <th className="px-5 py-3 font-medium">Size</th>
                <th className="px-5 py-3 font-medium">Copied</th>
                <th className="px-5 py-3 font-medium">Downloads</th>
                <th className="px-5 py-3 font-medium">♥</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {d.files.map((f) => (
                <tr key={f.id}>
                  <td className="max-w-72 truncate px-5 py-2.5">
                    <Link href={`/admin/media/${f.mediaId}`} className="hover:text-ocean-300">
                      {f.filename}
                    </Link>
                    <p className="truncate font-mono text-[10px] text-mist-400">{f.checksum ? `sha256 ${f.checksum.slice(0, 16)}…` : ""}</p>
                  </td>
                  <td className="px-5 py-2.5">
                    <QualityLabel label={f.label} />
                  </td>
                  <td className="tabular px-5 py-2.5 text-mist-300">{formatBytes(f.size)}</td>
                  <td className="px-5 py-2.5 text-xs text-mist-400">{f.copiedAt ? "✓" : d.status === "PREPARING" ? "copying…" : "—"}</td>
                  <td className="tabular px-5 py-2.5">{f._count.downloads}</td>
                  <td className="tabular px-5 py-2.5">{f._count.favorites}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="ZIP packages">
          {d.packages.length === 0 ? (
            <p className="text-sm text-mist-400">No packages.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {d.packages.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">{p.filename}</span>
                  <span className="flex items-center gap-2 text-xs text-mist-400">
                    {formatBytes(p.size)} <StatusBadge status={p.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-mist-400">Packages are temporary delivery assets and are deleted at expiry.</p>
        </Card>
      </div>
    </>
  );
}
