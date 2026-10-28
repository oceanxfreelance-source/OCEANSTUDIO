import type { Metadata } from "next";
import { firstBookableDay, getAvailability } from "@/lib/availability";
import { bookingPackagePrice, getShopConfig, paymentMethods } from "@/lib/shop";
import { getContent } from "@/lib/content";
import { instagramDmUrl } from "@/lib/format";
import { BookingForm } from "./BookingForm";

export const metadata: Metadata = {
  title: "Book a filmed surf session at Machines",
  description: "Book Ocean X to film your surf session at Machines, Maabaidhoo — drone and camera, clips delivered the same day.",
  alternates: { canonical: "/book" },
};
export const dynamic = "force-dynamic";

export default async function BookPage() {
  const cfg = await getShopConfig();
  const dm = instagramDmUrl((await getContent())["social.instagram"]);
  const days = await getAvailability(cfg, firstBookableDay(), cfg.bookAheadDays);
  const packages = (["SESSION", "SESSION_REEL", "DRONE_CAMERA"] as const).flatMap((id) => {
    const price = bookingPackagePrice(cfg, id);
    return price ? [{ id, price, ...cfg.packages[id] }] : [];
  });

  return (
    <>
      <section className="min-h-screen bg-abyss pb-24 pt-28 text-foam md:pt-36">
        <div className="container-x">
          <h1 className="display text-4xl [font-stretch:112%] md:text-6xl">Book a session</h1>
          <p className="mt-3 max-w-xl text-mist">Pick a day and session, tell us how to spot you, and we&apos;ll film every wave. Your clips arrive on a private page the same day.</p>
          {dm && (
            <p className="mt-2 text-sm text-mist">
              Prefer to chat?{" "}
              <a href={dm} target="_blank" rel="noopener noreferrer" className="text-gold underline">
                Or DM us on Instagram
              </a>
            </p>
          )}
          <div className="mt-10">
          <BookingForm
            days={days.map((d) => ({ date: d.date, slots: { MORNING: d.slots.MORNING, MIDDAY: d.slots.MIDDAY, AFTERNOON: d.slots.AFTERNOON } }))}
            packages={packages}
            depositPercent={cfg.depositPercent}
            methods={paymentMethods(cfg)}
            bankDetails={cfg.bankDetails}
            cashText={cfg.cashText}
            slotTimes={cfg.slotTimes}
          />
          </div>
          <p className="mx-auto mt-16 max-w-2xl border-t border-foam/10 pt-6 text-center text-xs leading-relaxed text-mist">{cfg.notice}</p>
        </div>
      </section>
    </>
  );
}
