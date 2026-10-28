import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getAvailability } from "@/lib/availability";
import { parseDay, todayMaldives } from "@/lib/clips";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getShopConfig } from "@/lib/shop";
import { SLOTS } from "@/lib/shop-rules";
import { AvailabilityForm } from "./AvailabilityForm";

export const metadata = { title: "Availability" };

export default async function AvailabilityPage() {
  await requireAdmin();
  const cfg = await getShopConfig();
  const from = todayMaldives();
  const days = 42;
  const [avail, overrides] = await Promise.all([
    getAvailability(cfg, from, days),
    db.availability.findMany({ where: { date: { gte: parseDay(from)! } } }),
  ]);
  return (
    <>
      <PageHeader title="Availability" subtitle="How many bookings each session can take over the next 6 weeks." back={{ href: "/superadmin/bookings", label: "Bookings" }} />
      <AvailabilityForm
        defaultMax={cfg.maxPerSlot}
        days={avail.map((d) => ({
          date: d.date,
          label: formatDate(new Date(`${d.date}T00:00:00Z`), { weekday: "short", day: "numeric", month: "short" }),
          slots: Object.fromEntries(
            SLOTS.map((s) => {
              const o = overrides.find((r) => r.date.toISOString().slice(0, 10) === d.date && r.slot === s);
              return [s, { max: o?.maxBookings ?? null, closed: !!o?.closed, booked: d.slots[s].booked }];
            }),
          ) as never,
        }))}
      />
    </>
  );
}
