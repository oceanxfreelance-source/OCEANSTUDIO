import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ButtonLink, Empty, PageHeader, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, money } from "@/lib/format";

export const metadata = { title: "Customers" };

export default async function CustomersAdmin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const q = (await searchParams).q?.trim().slice(0, 100);
  const where: Prisma.CustomerWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { instagram: { contains: q.replace(/^@/, ""), mode: "insensitive" } },
          { whatsapp: { contains: q } },
          { country: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};
  const customers = await db.customer.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 });
  const ids = customers.map((c) => c.id);

  // Per-customer stats in three grouped queries (not one query per row).
  const [sessions, paid, bookings] = await Promise.all([
    db.shootSession.groupBy({ by: ["customerId"], where: { customerId: { in: ids }, status: { not: "CANCELLED" } }, _count: true }),
    db.shootSession.groupBy({ by: ["customerId"], where: { customerId: { in: ids }, paymentStatus: "PAID", status: { not: "CANCELLED" } }, _sum: { price: true } }),
    db.booking.groupBy({ by: ["customerId"], where: { customerId: { in: ids } }, _min: { createdAt: true }, _max: { createdAt: true } }),
  ]);
  const stat = (id: string) => ({
    sessions: sessions.find((s) => s.customerId === id)?._count ?? 0,
    spent: paid.find((p) => p.customerId === id)?._sum.price ?? null,
    first: bookings.find((b) => b.customerId === id)?._min.createdAt ?? null,
    last: bookings.find((b) => b.customerId === id)?._max.createdAt ?? null,
  });

  return (
    <>
      <PageHeader title="Customers" subtitle="Private customer records. Customers never get accounts or logins." actions={<ButtonLink href="/superadmin/customers/new">+ Add customer</ButtonLink>} />
      <form className="mb-5">
        <input name="q" defaultValue={q} placeholder="Search name, @instagram, email, country…" className="w-full rounded-lg border border-slate/30 bg-white px-3 py-2 text-sm md:w-80" />
      </form>
      {customers.length === 0 ? (
        <Empty>{q ? "No customers match." : "No customers yet. They're created automatically from booking requests."}</Empty>
      ) : (
        <Table head={["Name", "Contact", "Country", "Sessions", "Total spent", "First booking", "Last booking"]}>
          {customers.map((c) => {
            const s = stat(c.id);
            return (
              <tr key={c.id} className="hover:bg-foam/40">
                <td className="px-4 py-3">
                  <Link href={`/superadmin/customers/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-slate">
                  {c.instagram && <span className="block">@{c.instagram}</span>}
                  {c.email && <span className="block">{c.email}</span>}
                  {c.whatsapp && <span className="block">{c.whatsapp}</span>}
                </td>
                <td className="px-4 py-3 text-slate">{c.country ?? "—"}</td>
                <td className="px-4 py-3">{s.sessions}</td>
                <td className="px-4 py-3">{money(s.spent)}</td>
                <td className="px-4 py-3 text-slate">{formatDate(s.first)}</td>
                <td className="px-4 py-3 text-slate">{formatDate(s.last)}</td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
