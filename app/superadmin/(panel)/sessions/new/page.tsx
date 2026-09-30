import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveSession } from "../actions";
import { SessionForm, type SessionValues } from "../SessionForm";

export const metadata = { title: "New session" };

export default async function NewSession({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [customers, services] = await Promise.all([
    db.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, instagram: true } }),
    db.service.findMany({ orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  const values: SessionValues = {
    customerId: sp.customer ?? "",
    serviceId: null,
    locationText: "Machines",
    date: null,
    time: null,
    people: null,
    clips: null,
    price: null,
    paymentStatus: "UNPAID",
    status: "SCHEDULED",
    deliveryStatus: "NOT_READY",
    deliveryLink: null,
    notes: "",
  };

  return (
    <>
      <PageHeader
        title="New session"
        subtitle={customers.length === 0 ? "Add the customer first under Customers." : undefined}
        back={{ href: "/superadmin/sessions", label: "Sessions" }}
      />
      <SessionForm action={saveSession.bind(null, null)} values={values} customers={customers} services={services} isNew />
    </>
  );
}
