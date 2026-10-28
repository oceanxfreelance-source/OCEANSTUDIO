import { ContentGroupForm } from "@/components/admin/ContentGroupForm";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getContent } from "@/lib/content";

export const metadata = { title: "Prices & payment" };

export default async function PricesAdmin() {
  await requireAdmin();
  const c = await getContent();
  return (
    <>
      <PageHeader title="Prices & payment" subtitle="Prices are in USD. Type a number only, e.g. 20. Changes show on the website straight away." />
      <div className="space-y-6">
        <ContentGroupForm group="Clip shop — prices" c={c} title="Prices" saveLabel="Save prices" />
        <ContentGroupForm group="Clip shop — payment" c={c} title="How guests pay" saveLabel="Save payment details" />
        <ContentGroupForm group="Clip shop — sessions" c={c} title="Sessions, downloads & storage" saveLabel="Save" />
      </div>
    </>
  );
}
