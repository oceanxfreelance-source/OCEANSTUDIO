import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { saveTestimonial } from "../actions";
import { TestimonialForm } from "../TestimonialForm";

export const metadata = { title: "Add testimonial" };

export default async function NewTestimonial() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Add testimonial" back={{ href: "/superadmin/testimonials", label: "Testimonials" }} />
      <TestimonialForm action={saveTestimonial.bind(null, null)} />
    </>
  );
}
