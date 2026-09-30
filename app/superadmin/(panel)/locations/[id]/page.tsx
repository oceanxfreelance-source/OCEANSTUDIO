import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteLocation, saveLocation } from "../actions";
import { LocationForm } from "../LocationForm";

export const metadata = { title: "Edit location" };

export default async function EditLocation({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const location = await db.location.findUnique({ where: { id }, include: { images: { orderBy: { position: "asc" } } } });
  if (!location) notFound();
  const { created } = await searchParams;
  return (
    <>
      <PageHeader
        title={location.name}
        back={{ href: "/superadmin/locations", label: "Laamu locations" }}
        actions={
          <>
            {location.published && (
              <Link href={`/laamu/${location.slug}`} target="_blank" className="rounded-lg border border-slate/30 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-foam">
                View on website ↗
              </Link>
            )}
            <ConfirmButton action={deleteLocation.bind(null, location.id)} confirm={`Delete "${location.name}"? Portfolio items keep existing without a location.`}>
              Delete
            </ConfirmButton>
          </>
        }
      />
      {created && <p className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Location added.</p>}
      <LocationForm action={saveLocation.bind(null, location.id)} location={location} />
    </>
  );
}
