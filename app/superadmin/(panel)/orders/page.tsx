import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { Badge, Empty, PageHeader } from "@/components/admin/ui";
import { cx } from "@/components/ui/cx";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, money } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/orders";

export const metadata = { title: "Orders" };

const VIEWS: Record<string, { label: string; status?: OrderStatus }> = {
  waiting: { label: "Waiting for payment", status: "AWAITING_PAYMENT" },
  paid: { label: "Paid — to deliver", status: "PAID" },
  delivered: { label: "Delivered", status: "DELIVERED" },
  all: { label: "All" },
};

export default async function OrdersAdmin({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const view = sp.view && sp.view in VIEWS ? sp.view : "waiting";
  const orders = await db.order.findMany({
    where: VIEWS[view]!.status ? { status: VIEWS[view]!.status } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { _count: { select: { slips: true } }, sessions: { select: { package: true, _count: { select: { items: true } } } } },
  });
  return (
    <>
      <PageHeader title="Orders" subtitle="Clips bought from the gallery." />
      <div className="mb-5 flex flex-wrap gap-2">
        {Object.entries(VIEWS).map(([k, v]) => (
          <Link key={k} href={`/superadmin/orders?view=${k}`} className={cx("rounded-full border px-3 py-1 text-xs", view === k ? "border-abyss bg-abyss text-white" : "border-slate/25 bg-white hover:bg-foam")}>
            {v.label}
          </Link>
        ))}
      </div>
      {orders.length === 0 ? (
        <Empty>No orders here.</Empty>
      ) : (
        <ul className="divide-y divide-slate/10 rounded-xl border border-slate/15 bg-white">
          {orders.map((o) => {
            const clips = o.sessions.reduce((n, s) => n + s._count.items, 0);
            return (
              <li key={o.id}>
                <Link href={`/superadmin/orders/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:bg-foam/50">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {o.name} <span className="font-normal text-slate">· {money(o.total)}</span>
                    </span>
                    <span className="block text-xs text-slate">
                      {o.reference} · {clips} clip{clips === 1 ? "" : "s"}
                      {o.sessions.some((s) => s.package !== "CLIPS") && " · full session"}
                      {o.sessions.some((s) => s.package === "SESSION_REEL") && " + reel"} · {o.paymentMethod === "BANK_TRANSFER" ? "bank" : "cash"} · {formatDateTime(o.createdAt)}
                    </span>
                  </span>
                  <span className="flex gap-1.5">
                    <Badge tone={ORDER_STATUS[o.status][1]}>{ORDER_STATUS[o.status][0]}</Badge>
                    {o._count.slips > 0 && o.status === "AWAITING_PAYMENT" && <Badge tone="amber">Slip ✓</Badge>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
