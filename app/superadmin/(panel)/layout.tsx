import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logoutAction } from "../actions";

// Admin pages are always rendered fresh and only for a signed-in admin.
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const pendingReviews = await db.testimonial.count({ where: { pending: true } });
  return (
    <>
      <AdminNav pendingReviews={pendingReviews} onLogout={logoutAction} adminName={admin.name} />
      <div className="lg:pl-64">
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">{children}</main>
      </div>
    </>
  );
}
