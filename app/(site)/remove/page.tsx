import type { Metadata } from "next";
import { getShopConfig } from "@/lib/shop";
import { RemoveForm } from "./RemoveForm";

export const metadata: Metadata = { title: "Remove my clip", description: "Don't want to be in the Ocean X clip gallery? Tell us the clip code and we'll take it down.", alternates: { canonical: "/remove" } };

export default async function RemovePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const [{ code }, cfg] = await Promise.all([searchParams, getShopConfig()]);
  return (
    <section className="min-h-screen bg-abyss pb-24 pt-32 text-foam md:pt-40">
      <div className="container-x max-w-xl">
        <p className="eyebrow eyebrow-line text-gold">Privacy</p>
        <h1 className="display mt-4 text-4xl [font-stretch:112%] md:text-5xl">Remove my clip</h1>
        <p className="mt-5 text-mist">{cfg.notice}</p>
        <p className="mt-3 text-mist">Enter the clip code (top-left corner of the clip). It leaves the public gallery immediately.</p>
        <div className="mt-10">
          <RemoveForm code={code?.slice(0, 20)} />
        </div>
      </div>
    </section>
  );
}
