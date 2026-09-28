import Link from "next/link";
import { Card, EmptyState, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { LocalTime } from "@/components/ui/LocalTime";
import { formatBytes } from "@/lib/labels";
import { dashboardStats } from "@/server/stats";

export default async function DashboardPage() {
  const s = await dashboardStats();
  return (
    <>
      <PageHeader eyebrow="Overview" title="Dashboard" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 2xl:grid-cols-8">
        <Stat label="Projects" value={s.totalProjects} />
        <Stat label="Active projects" value={s.activeProjects} />
        <Stat label="Processing" value={s.processing} sub={`${s.queued} queued`} />
        <Stat label="Active deliveries" value={s.activeDeliveries} />
        <Stat label="Expiring < 6h" value={s.expiring.length} tone={s.expiring.length ? "warn" : undefined} />
        <Stat label="Storage" value={formatBytes(s.storage.total)} sub={`${formatBytes(s.storage.masters)} masters`} />
        <Stat label="Recent downloads" value={s.recentDownloads.length} />
        <Stat label="Failed jobs" value={s.failedJobs.length} tone={s.failedJobs.length ? "error" : undefined} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <Card title="Expiring deliveries" action={<Link href="/admin/deliveries" className="text-xs text-ocean-300 hover:underline">All deliveries</Link>}>
          {s.expiring.length === 0 ? (
            <p className="text-sm text-mist-400">No deliveries expire in the next 6 hours.</p>
          ) : (
            <ul className="divide-y divide-ink-700">
              {s.expiring.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2.5 text-sm">
                  <Link href={`/admin/deliveries/${d.id}`} className="hover:text-ocean-300">
                    {d.title} <span className="text-mist-400">· {d.client.name}</span>
                  </Link>
                  <span className="text-xs text-sand-400">
                    <LocalTime iso={d.expiresAt} relative />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Failed jobs" action={<Link href="/admin/processing?status=FAILED" className="text-xs text-ocean-300 hover:underline">Processing center</Link>}>
          {s.failedJobs.length === 0 ? (
            <p className="text-sm text-mist-400">No failed jobs.</p>
          ) : (
            <ul className="divide-y divide-ink-700">
              {s.failedJobs.map((j) => (
                <li key={j.id} className="py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate">{j.media?.filename ?? j.jobType}</span>
                    <StatusBadge status="FAILED" />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-mist-400">{j.errorMessage}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent downloads" action={<Link href="/admin/downloads" className="text-xs text-ocean-300 hover:underline">Analytics</Link>}>
          {s.recentDownloads.length === 0 ? (
            <EmptyState title="No downloads yet" />
          ) : (
            <ul className="divide-y divide-ink-700">
              {s.recentDownloads.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="truncate">{d.label}</span>
                  <span className="shrink-0 text-xs text-mist-400">
                    {d.delivery?.title ?? "Admin"} · <LocalTime iso={d.createdAt} relative />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
