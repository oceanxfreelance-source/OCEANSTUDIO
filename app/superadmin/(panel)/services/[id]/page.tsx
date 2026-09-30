import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteService, saveService } from "../actions";
import { ServiceForm } from "../ServiceForm";

export const metadata = { title: "Edit service" };

export default async function EditService({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const service = await db.service.findUnique({ where: { id }, include: { images: { orderBy: { position: "asc" } } } });
  if (!service) notFound();
  const { created } = await searchParams;

  return (
    <>
      <PageHeader
        title={service.name}
        back={{ href: "/superadmin/services", label: "Services" }}
        actions={
          <>
            {service.published && service.status !== "HIDDEN" && (
              <Link href={`/services/${service.slug}`} target="_blank" className="rounded-lg border border-slate/30 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-foam">
                View on website ↗
              </Link>
            )}
            <ConfirmButton action={deleteService.bind(null, service.id)} confirm={`Delete "${service.name}"? Past sessions keep their record.`}>
              Delete
            </ConfirmButton>
          </>
        }
      />
      {created && <p className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Service created.</p>}
      <ServiceForm action={saveService.bind(null, service.id)} service={service} />
    </>
  );
}
