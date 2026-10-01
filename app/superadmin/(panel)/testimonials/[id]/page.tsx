import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteTestimonial, saveTestimonial } from "../actions";
import { TestimonialForm } from "../TestimonialForm";

export const metadata = { title: "Edit review" };

export default async function EditTestimonial({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const t = await db.testimonial.findUnique({ where: { id } });
  if (!t) notFound();
  return (
    <>
      <PageHeader
        title={`Review — ${t.name}`}
        back={{ href: "/superadmin/testimonials", label: "Reviews" }}
        actions={
          <ConfirmButton action={deleteTestimonial.bind(null, t.id)} confirm="Delete this review?">
            Delete
          </ConfirmButton>
        }
      />
      <TestimonialForm action={saveTestimonial.bind(null, t.id)} t={t} />
    </>
  );
}
