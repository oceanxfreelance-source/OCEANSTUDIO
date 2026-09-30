import Link from "next/link";
import { Badge, ButtonLink, Empty, PageHeader, STATUS_TONE, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { SERVICE_STATUS_LABEL } from "@/lib/constants";
import { db } from "@/lib/db";
import { priceLabel } from "@/lib/format";
import { setServiceStatus } from "./actions";

export const metadata = { title: "Services" };

export default async function ServicesAdmin() {
  await requireAdmin();
  const services = await db.service.findMany({ orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }], include: { _count: { select: { bookings: true } } } });

  return (
    <>
      <PageHeader title="Services" subtitle="What appears on the Services page. Change a status and the website updates instantly." actions={<ButtonLink href="/superadmin/services/new">+ Add service</ButtonLink>} />
      {services.length === 0 ? (
        <Empty>No services yet.</Empty>
      ) : (
        <Table head={["Service", "Status", "Price", "Visibility", "Bookings", "Quick change"]}>
          {services.map((s) => (
            <tr key={s.id} className="hover:bg-foam/40">
              <td className="px-4 py-3">
                <Link href={`/superadmin/services/${s.id}`} className="font-medium hover:underline">
                  {s.name}
                </Link>
                <span className="block text-xs text-slate">Order {s.displayOrder}{s.featured ? " · Featured" : ""}</span>
              </td>
              <td className="px-4 py-3">
                <Badge tone={STATUS_TONE[s.status]}>{SERVICE_STATUS_LABEL[s.status]}</Badge>
              </td>
              <td className="px-4 py-3 text-slate">{priceLabel(s.price, s.priceType, s.currency)}</td>
              <td className="px-4 py-3">{s.published ? <Badge tone="green">Published</Badge> : <Badge>Draft</Badge>}</td>
              <td className="px-4 py-3 text-slate">{s._count.bookings}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  {(["ACTIVE", "COMING_SOON", "HIDDEN"] as const)
                    .filter((st) => st !== s.status)
                    .map((st) => (
                      <form key={st} action={setServiceStatus.bind(null, s.id, st)}>
                        <button className="rounded-md border border-slate/25 px-2 py-1 text-xs hover:bg-foam">→ {SERVICE_STATUS_LABEL[st]}</button>
                      </form>
                    ))}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
