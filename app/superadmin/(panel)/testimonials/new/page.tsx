import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { saveTestimonial } from "../actions";
import { TestimonialForm } from "../TestimonialForm";

export const metadata = { title: "Add review" };

export default async function NewTestimonial() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Add review" back={{ href: "/superadmin/testimonials", label: "Reviews" }} />
      <TestimonialForm action={saveTestimonial.bind(null, null)} />
    </>
  );
}
