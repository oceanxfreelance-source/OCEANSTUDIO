import { JobsTable } from "@/components/admin/JobsTable";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Processing" };

export default async function ProcessingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return (
    <>
      <PageHeader eyebrow="Workers" title="Processing center" />
      <JobsTable initialStatus={status} />
    </>
  );
}
