import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logoutAction } from "../actions";

// Admin pages are always rendered fresh and only for a signed-in admin.
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const newBookings = await db.booking.count({ where: { status: "NEW" } });
  return (
    <>
      <AdminNav newBookings={newBookings} onLogout={logoutAction} adminName={admin.name} />
      <div className="lg:pl-64">
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">{children}</main>
      </div>
    </>
  );
}
