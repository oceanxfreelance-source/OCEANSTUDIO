import { NewClientButton } from "@/components/admin/Forms";
import { EmptyState, PageHeader } from "@/components/ui";
import { listClients } from "@/server/clients";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const clients = await listClients();
  return (
    <>
      <PageHeader eyebrow="People" title="Clients">
        <NewClientButton />
      </PageHeader>
      {clients.length === 0 ? (
        <EmptyState title="No clients yet">Clients receive private, password-protected 48-hour galleries.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-ink-700">
          <table className="w-full text-sm">
            <thead className="bg-ink-850 text-left text-xs text-mist-400">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">Projects</th>
                <th className="px-5 py-3 font-medium">Deliveries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 font-medium">{c.name}</td>
                  <td className="px-5 py-3 text-mist-300">{c.email ?? "—"}</td>
                  <td className="px-5 py-3 text-mist-300">{c.phone ?? "—"}</td>
                  <td className="tabular px-5 py-3 text-mist-300">{c._count.projects}</td>
                  <td className="tabular px-5 py-3 text-mist-300">{c._count.deliveries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
