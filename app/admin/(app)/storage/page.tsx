import { Card, PageHeader, Stat } from "@/components/ui";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/labels";
import { storageUsage } from "@/server/stats";

export const metadata = { title: "Storage" };

export default async function StoragePage() {
  const s = await storageUsage();
  const pendingDeletion = await db.delivery.count({ where: { status: { in: ["EXPIRED", "DELETING", "REVOKED"] } } });
  const rows: [string, number, string][] = [
    ["Master storage", s.masters, "Immutable originals (permanent)"],
    ["RAW storage", s.raw, "RAW masters — included in master storage"],
    ["Derivative storage", s.derivatives, "RAW developments, AI & colour versions (permanent)"],
    ["Preview storage", s.previews, "Browser previews & video proxies"],
    ["Temporary delivery storage", s.temporary, "Client copies, previews, ZIPs — deleted at expiry"],
    ["Processing storage", s.processing, "Worker scratch objects"],
  ];
  return (
    <>
      <PageHeader eyebrow="Private object storage" title="Storage" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Masters" value={formatBytes(s.masters)} />
        <Stat label="Derivatives" value={formatBytes(s.derivatives)} />
        <Stat label="Temporary" value={formatBytes(s.temporary)} sub={`${pendingDeletion} deliveries awaiting cleanup`} />
        <Stat label="Total" value={formatBytes(s.total)} />
      </div>
      <Card className="mt-6" title="Breakdown" padded={false}>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-ink-700">
            {rows.map(([label, bytes, note]) => (
              <tr key={label}>
                <td className="px-5 py-3 font-medium">{label}</td>
                <td className="px-5 py-3 text-xs text-mist-400">{note}</td>
                <td className="tabular px-5 py-3 text-right">{formatBytes(bytes)}</td>
                <td className="w-64 px-5 py-3">
                  <div className="h-1.5 rounded-full bg-ink-700">
                    <div className="h-full rounded-full bg-ocean-400" style={{ width: `${s.total ? Math.max(0.5, (bytes / s.total) * 100) : 0}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="mt-6" title="Lifecycle rules">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-mist-300">
          <li>
            <code className="font-mono text-xs">projects/…/masters/…</code> is written once (after validation) and can never be deleted or overwritten by the application; database triggers enforce the same.
          </li>
          <li>
            Expiration cleanup only deletes objects under <code className="font-mono text-xs">deliveries/&#123;deliveryId&#125;/</code> and registered temporary objects of that delivery.
          </li>
          <li>Enable bucket versioning / object lock on the masters prefix for an additional provider-level safety net (see README).</li>
        </ul>
      </Card>
    </>
  );
}
