import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { saveLocation } from "../actions";
import { LocationForm } from "../LocationForm";

export const metadata = { title: "Add location" };

export default async function NewLocation() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Add location" back={{ href: "/superadmin/locations", label: "Locations" }} />
      <LocationForm action={saveLocation.bind(null, null)} />
    </>
  );
}
