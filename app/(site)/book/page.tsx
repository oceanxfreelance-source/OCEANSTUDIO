import type { Metadata } from "next";
import { PageHero } from "@/components/site/Section";
import { firstBookableDay, getAvailability } from "@/lib/availability";
import { getShopSpots } from "@/lib/clip-shop";
import { bookingPackagePrice, getShopConfig, paymentMethods } from "@/lib/shop";
import { BookingForm } from "./BookingForm";

export const metadata: Metadata = {
  title: "Book a filmed surf session at Machines",
  description: "Book Ocean X to film your surf session at Machines, Maabaidhoo — drone and camera, clips delivered the same day.",
  alternates: { canonical: "/book" },
};
export const dynamic = "force-dynamic";

export default async function BookPage() {
  const cfg = await getShopConfig();
  const [days, spots] = await Promise.all([getAvailability(cfg, firstBookableDay(), cfg.bookAheadDays), getShopSpots()]);
  const packages = (["SESSION", "SESSION_REEL", "DRONE_CAMERA"] as const).flatMap((id) => {
    const price = bookingPackagePrice(cfg, id);
    return price ? [{ id, price }] : [];
  });

  return (
    <>
      <PageHero eyebrow="Book a session" title="We film. You surf." intro="Pick a day and session, tell us how to spot you, and we'll film every wave. Your clips arrive on a private page the same day." />
      <section className="bg-abyss pb-24 pt-4 text-foam">
        <div className="container-x">
          <BookingForm
            days={days.map((d) => ({ date: d.date, slots: { MORNING: d.slots.MORNING, MIDDAY: d.slots.MIDDAY, AFTERNOON: d.slots.AFTERNOON } }))}
            spots={spots.map((s) => ({ id: s.id, name: s.name }))}
            packages={packages}
            depositPercent={cfg.depositPercent}
            methods={paymentMethods(cfg)}
            bankDetails={cfg.bankDetails}
            cashText={cfg.cashText}
            slotTimes={cfg.slotTimes}
          />
          <p className="mx-auto mt-16 max-w-2xl border-t border-foam/10 pt-6 text-center text-xs leading-relaxed text-mist">{cfg.notice}</p>
        </div>
      </section>
    </>
  );
}
