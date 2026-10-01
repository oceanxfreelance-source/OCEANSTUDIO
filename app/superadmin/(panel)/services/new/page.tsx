import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { saveService } from "../actions";
import { ServiceForm } from "../ServiceForm";

export const metadata = { title: "New service" };

export default async function NewService() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Add service" back={{ href: "/superadmin/services", label: "Services" }} />
      <ServiceForm action={saveService.bind(null, null)} />
    </>
  );
}
