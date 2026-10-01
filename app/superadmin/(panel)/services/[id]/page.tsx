import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteService, saveService } from "../actions";
import { ServiceForm } from "../ServiceForm";
import { BulkVideoUpload } from "../../portfolio/BulkVideoUpload";
import { posterFor } from "@/lib/video";

export const metadata = { title: "Edit service" };

export default async function EditService({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const service = await db.service.findUnique({
    where: { id },
    include: {
      images: { orderBy: { position: "asc" } },
      films: { orderBy: [{ featured: "desc" }, { displayOrder: "asc" }, { date: "desc" }, { createdAt: "desc" }], select: { id: true, title: true, videoUrl: true, published: true } },
    },
  });
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
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Films on this page ({service.films.length})</h2>
        <BulkVideoUpload serviceId={service.id} serviceName={service.name} />
        {service.films.length > 0 && (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {service.films.map((f) => (
              <li key={f.id}>
                <Link href={`/superadmin/portfolio/${f.id}`} className="block">
                  <span className="block aspect-[4/5] overflow-hidden rounded-lg bg-foam">
                    {posterFor(f.videoUrl) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={posterFor(f.videoUrl)!} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="mt-1 block truncate text-xs">{f.title}</span>
                  {!f.published && <span className="block text-[11px] text-slate">Hidden</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ServiceForm action={saveService.bind(null, service.id)} service={service} />
    </>
  );
}
