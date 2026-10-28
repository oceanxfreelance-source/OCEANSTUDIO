import { ClipUploader } from "@/components/admin/ClipUploader";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { ACTIVE_BOOKING, bookingLabel } from "@/lib/bookings";
import { dayString, todayMaldives } from "@/lib/clips";
import { db } from "@/lib/db";
import { storageDriver, storageReady } from "@/lib/storage";
import type { Slot } from "@/lib/shop-rules";

export const metadata = { title: "Upload clips" };

export default async function UploadClips({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  await requireAdmin();
  const { booking: bookingParam } = await searchParams;
  const today = todayMaldives();
  const from = new Date(Date.now() - 14 * 86400_000);
  const [spots, bookings] = await Promise.all([
    db.location.findMany({ where: { code: { not: null } }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, code: true } }),
    db.booking.findMany({
      where: { token: { not: null }, status: { in: ACTIVE_BOOKING }, preferredDate: { gte: from } },
      orderBy: [{ preferredDate: "asc" }, { slot: "asc" }],
      select: { id: true, reference: true, fullName: true, preferredDate: true, slot: true, locationId: true },
    }),
  ]);
  const pre = bookings.find((b) => b.id === bookingParam);
  const hour = new Date(Date.now() + 5 * 3600_000).getUTCHours();
  const defaultSlot: Slot = hour < 10 ? "MORNING" : hour < 14 ? "MIDDAY" : "AFTERNOON";

  return (
    <>
      <PageHeader title="Upload clips" subtitle="One session at a time: choose the day, time and spot, then pick all the clips." back={{ href: "/superadmin/clips", label: "Clips" }} />
      {storageReady() ? (
        <ClipUploader
          spots={spots.map((s) => ({ ...s, code: s.code! }))}
          bookings={bookings.map((b) => ({ id: b.id, label: bookingLabel(b), date: b.preferredDate ? dayString(b.preferredDate) : null, slot: b.slot }))}
          driver={storageDriver()}
          initial={{
            date: pre?.preferredDate ? dayString(pre.preferredDate) : today,
            slot: pre?.slot ?? defaultSlot,
            spotId: pre?.locationId && spots.some((s) => s.id === pre.locationId) ? pre.locationId : null,
            bookingId: pre?.id ?? "",
          }}
        />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">Clip storage isn&apos;t connected yet, so clips can&apos;t be uploaded.</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5">
            <li>Open vercel.com → Storage → <strong>oceanx-clips-private</strong>.</li>
            <li>Tap <strong>Connect Project</strong> and choose <strong>oceanx-studio</strong>.</li>
            <li>Set the environment variable prefix to <strong>PRIVATE_BLOB</strong>, tick Production and Preview, and connect.</li>
            <li>Redeploy the site (Deployments → ⋯ → Redeploy). Then come back here.</li>
          </ol>
        </div>
      )}
    </>
  );
}
