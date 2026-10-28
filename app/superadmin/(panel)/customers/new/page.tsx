import { Card, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { saveCustomer } from "../actions";
import { CustomerForm } from "../CustomerForm";

export const metadata = { title: "Add customer" };

export default async function NewCustomer() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Add customer" subtitle="For customers who booked by message instead of the website form." back={{ href: "/superadmin/customers", label: "Customers" }} />
      <Card className="max-w-3xl">
        <CustomerForm action={saveCustomer.bind(null, null)} />
      </Card>
    </>
  );
}
