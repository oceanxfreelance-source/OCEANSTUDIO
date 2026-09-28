import { redirect } from "next/navigation";
import { Sidebar } from "@/components/admin/Sidebar";
import { getAdminFromCookies } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

/** Every admin page is verified against the session table (not just cookie presence). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminFromCookies();
  if (!ctx) redirect("/admin/login");
  return (
    <div className="flex min-h-dvh">
      <Sidebar adminName={ctx.admin.name} />
      <main id="main" className="min-w-0 flex-1 px-10 py-9 2xl:px-14">
        <div className="mx-auto max-w-[1680px] animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
