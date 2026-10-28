import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Card, PageHeader, TextField } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { changePassword, signOutEverywhere } from "./actions";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const admin = await requireAdmin();
  const sessions = await db.adminSession.findMany({ where: { adminId: admin.id, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Account" subtitle={admin.email} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Change password">
          <ActionForm action={changePassword}>
            <div className="space-y-4">
              <TextField label="Current password" name="current" type="password" autoComplete="current-password" required />
              <TextField label="New password" name="next" type="password" autoComplete="new-password" required hint="At least 12 characters." />
              <TextField label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
              <SubmitButton>Change password</SubmitButton>
            </div>
          </ActionForm>
        </Card>
        <Card title="Signed-in devices">
          <ul className="space-y-2 text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="rounded-lg border border-slate/15 px-3 py-2">
                <span className="block truncate">{s.userAgent ?? "Unknown device"}</span>
                <span className="text-xs text-slate">Signed in {formatDateTime(s.createdAt)}</span>
              </li>
            ))}
          </ul>
          <form action={signOutEverywhere} className="mt-4">
            <button className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Sign out on all devices</button>
          </form>
        </Card>
      </div>
    </>
  );
}
