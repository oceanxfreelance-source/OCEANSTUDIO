import type { Metadata } from "next";
import { LocationCard } from "@/components/site/Cards";
import { EmptyState, PageHero } from "@/components/site/Section";
import { getContent } from "@/lib/content";
import { getLocations } from "@/lib/public";

export const metadata: Metadata = {
  title: "Machines & Maabaidhoo",
  description: "Machines surf break and Maabaidhoo island in Laamu Atoll, Maldives — where Ocean X films and photographs.",
  alternates: { canonical: "/machines" },
};

export default async function MachinesPage() {
  const [c, locations] = await Promise.all([getContent(), getLocations()]);
  const featured = locations.filter((l) => l.featured);
  const others = locations.filter((l) => !l.featured);

  return (
    <>
      <PageHero eyebrow="Machines • Maabaidhoo • Laamu" title="Where we work." intro={c["laamu.intro"]} />
      <section className="bg-ink pb-24 text-foam md:pb-32">
        <div className="container-x pt-4">
          {locations.length === 0 ? (
            <EmptyState dark title="Locations coming soon" body="Photos of Machines and Maabaidhoo are on their way." />
          ) : (
            <>
              {featured.length > 0 && (
                <div className="grid gap-6 sm:grid-cols-2">
                  {featured.map((l) => (
                    <LocationCard key={l.id} l={l} wide />
                  ))}
                </div>
              )}
              {others.length > 0 && (
                <div className={featured.length ? "mt-16" : ""}>
                  {featured.length > 0 && <p className="eyebrow mb-8 text-mist">More places</p>}
                  <div className="grid gap-6 sm:grid-cols-2">
                    {others.map((l) => (
                      <LocationCard key={l.id} l={l} wide />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
