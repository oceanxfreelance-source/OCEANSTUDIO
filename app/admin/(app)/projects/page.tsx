import Link from "next/link";
import { NewProjectButton } from "@/components/admin/Forms";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { LocalTime } from "@/components/ui/LocalTime";
import { listClients } from "@/server/clients";
import { listProjects } from "@/server/projects";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const [projects, clients] = await Promise.all([listProjects({ status }), listClients()]);
  const tabs = ["", "DRAFT", "PROCESSING", "READY", "ACTIVE", "ARCHIVED"];
  return (
    <>
      <PageHeader eyebrow="Library" title="Projects">
        <NewProjectButton clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
      </PageHeader>
      <nav className="mb-5 flex gap-1" aria-label="Filter by status">
        {tabs.map((t) => (
          <Link
            key={t}
            href={t ? `/admin/projects?status=${t}` : "/admin/projects"}
            aria-current={(status ?? "") === t ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-xs ${(status ?? "") === t ? "bg-ink-750 text-mist-100" : "text-mist-400 hover:text-mist-200"}`}
          >
            {t || "All"}
          </Link>
        ))}
      </nav>
      {projects.length === 0 ? (
        <EmptyState title="No projects yet">Create a project, add a client and upload your originals.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-ink-700">
          <table className="w-full text-sm">
            <thead className="bg-ink-850 text-left text-xs text-mist-400">
              <tr>
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Files</th>
                <th className="px-5 py-3 font-medium">Deliveries</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-ink-850">
                  <td className="px-5 py-3">
                    <Link href={`/admin/projects/${p.id}`} className="font-medium text-mist-100 hover:text-ocean-300">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-mist-300">{p.client?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-mist-300">{p.shootDate ? <LocalTime iso={p.shootDate} /> : "—"}</td>
                  <td className="tabular px-5 py-3 text-mist-300">{p._count.media}</td>
                  <td className="tabular px-5 py-3 text-mist-300">{p._count.deliveries}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
