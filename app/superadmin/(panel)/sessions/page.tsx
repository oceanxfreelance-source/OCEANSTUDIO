import Link from "next/link";
import { Badge, ButtonLink, Empty, PageHeader, STATUS_TONE, Table } from "@/components/admin/ui";
import { cx } from "@/components/ui/cx";
import { requireAdmin } from "@/lib/auth";
import { DELIVERY_STATUS_LABEL, PAYMENT_STATUS_LABEL, SESSION_STATUS_LABEL } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, money } from "@/lib/format";

export const metadata = { title: "Sessions" };

type Status = keyof typeof SESSION_STATUS_LABEL;

export default async function SessionsAdmin({ searchParams }: { searchParams: Promise<{ status?: string; delivery?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = (Object.keys(SESSION_STATUS_LABEL) as Status[]).find((s) => s === sp.status);
  const pendingDelivery = sp.delivery === "pending";
  const sessions = await db.shootSession.findMany({
    where: { ...(status ? { status } : {}), ...(pendingDelivery ? { status: "COMPLETED", deliveryStatus: { not: "SENT" } } : {}) },
    orderBy: status === "SCHEDULED" ? { date: "asc" } : { date: "desc" },
    take: 300,
    include: { customer: { select: { name: true } } },
  });
  const tabs = [
    { href: "/superadmin/sessions", label: "All", active: !status && !pendingDelivery },
    ...(Object.keys(SESSION_STATUS_LABEL) as Status[]).map((s) => ({ href: `/superadmin/sessions?status=${s}`, label: SESSION_STATUS_LABEL[s], active: status === s })),
    { href: "/superadmin/sessions?delivery=pending", label: "Delivery pending", active: pendingDelivery },
  ];

  return (
    <>
      <PageHeader title="Sessions & delivery" subtitle="Confirmed shoots, payments and file delivery." actions={<ButtonLink href="/superadmin/sessions/new">+ New session</ButtonLink>} />
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={cx("rounded-full border px-3 py-1 text-xs", t.active ? "border-abyss bg-abyss text-white" : "border-slate/25 bg-white hover:bg-foam")}>
            {t.label}
          </Link>
        ))}
      </div>
      {sessions.length === 0 ? (
        <Empty>No sessions here. Create one from a confirmed booking.</Empty>
      ) : (
        <Table head={["Session", "Customer", "Date", "Service / location", "Price", "Status", "Delivery"]}>
          {sessions.map((s) => (
            <tr key={s.id} className="hover:bg-foam/40">
              <td className="px-4 py-3">
                <Link href={`/superadmin/sessions/${s.id}`} className="font-mono text-xs font-semibold hover:underline">
                  {s.code}
                </Link>
              </td>
              <td className="px-4 py-3 font-medium">{s.customer.name}</td>
              <td className="px-4 py-3 text-slate">
                {formatDate(s.date)}
                {s.time && <span className="block text-xs">{s.time}</span>}
              </td>
              <td className="px-4 py-3 text-slate">
                {s.serviceName || "—"}
                {s.locationText && <span className="block text-xs">{s.locationText}</span>}
              </td>
              <td className="px-4 py-3">
                {money(s.price)}
                <span className="block">
                  <Badge tone={STATUS_TONE[s.paymentStatus]}>{PAYMENT_STATUS_LABEL[s.paymentStatus]}</Badge>
                </span>
              </td>
              <td className="px-4 py-3">
                <Badge tone={STATUS_TONE[s.status]}>{SESSION_STATUS_LABEL[s.status]}</Badge>
              </td>
              <td className="px-4 py-3">
                <Badge tone={STATUS_TONE[s.deliveryStatus]}>{DELIVERY_STATUS_LABEL[s.deliveryStatus]}</Badge>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
