import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Badge, ButtonLink, Card, PageHeader, Stat, STATUS_TONE } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { BOOKING_STATUS_LABEL, SESSION_STATUS_LABEL } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, money, toNumber } from "@/lib/format";
import { deleteCustomer, saveCustomer } from "../actions";
import { CustomerForm } from "../CustomerForm";

export const metadata = { title: "Customer" };

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const c = await db.customer.findUnique({
    where: { id },
    include: { bookings: { orderBy: { createdAt: "desc" } }, sessions: { orderBy: { date: "desc" } } },
  });
  if (!c) notFound();

  const active = c.sessions.filter((s) => s.status !== "CANCELLED");
  const spent = active.filter((s) => s.paymentStatus === "PAID").reduce((sum, s) => sum + (toNumber(s.price) ?? 0), 0);
  const first = c.bookings.at(-1)?.createdAt ?? null;
  const last = c.bookings[0]?.createdAt ?? null;
  const canDelete = c.bookings.length === 0 && c.sessions.length === 0;

  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={`Customer since ${formatDate(c.createdAt)}`}
        back={{ href: "/superadmin/customers", label: "Customers" }}
        actions={
          <>
            <ButtonLink href={`/superadmin/sessions/new?customer=${c.id}`}>New session</ButtonLink>
            {canDelete && (
              <ConfirmButton action={deleteCustomer.bind(null, c.id)} confirm={`Delete ${c.name}?`}>
                Delete
              </ConfirmButton>
            )}
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sessions" value={active.length} />
        <Stat label="Total spent" value={money(spent)} />
        <Stat label="First booking" value={<span className="text-lg">{formatDate(first)}</span>} />
        <Stat label="Last booking" value={<span className="text-lg">{formatDate(last)}</span>} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card title="Details">
          <CustomerForm action={saveCustomer.bind(null, c.id)} c={c} />
        </Card>
        <div className="space-y-6">
          <Card title="Bookings">
            {c.bookings.length === 0 ? (
              <p className="text-sm text-slate">No bookings.</p>
            ) : (
              <ul className="divide-y divide-slate/10">
                {c.bookings.map((b) => (
                  <li key={b.id}>
                    <Link href={`/superadmin/bookings/${b.id}`} className="flex items-center justify-between py-2.5 text-sm hover:bg-foam/40">
                      <span>
                        {b.reference} · {b.serviceName || "—"} · {formatDate(b.createdAt)}
                      </span>
                      <Badge tone={STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Sessions">
            {c.sessions.length === 0 ? (
              <p className="text-sm text-slate">No sessions.</p>
            ) : (
              <ul className="divide-y divide-slate/10">
                {c.sessions.map((s) => (
                  <li key={s.id}>
                    <Link href={`/superadmin/sessions/${s.id}`} className="flex items-center justify-between py-2.5 text-sm hover:bg-foam/40">
                      <span>
                        {s.code} · {formatDate(s.date)} · {money(s.price)}
                      </span>
                      <Badge tone={STATUS_TONE[s.status]}>{SESSION_STATUS_LABEL[s.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
