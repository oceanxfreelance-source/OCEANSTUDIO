import type { Metadata } from "next";
import { LocationCard } from "@/components/site/Cards";
import { EmptyState, PageHero } from "@/components/site/Section";
import { getContent } from "@/lib/content";
import { getLocations } from "@/lib/public";

export const metadata: Metadata = {
  title: "Laamu, Maldives",
  description: "Surf breaks, islands and lagoons of Laamu Atoll — the places Ocean X films and photographs, from Machines to the local islands.",
  alternates: { canonical: "/laamu" },
};

export default async function LaamuPage() {
  const [c, locations] = await Promise.all([getContent(), getLocations()]);
  const featured = locations.filter((l) => l.featured);
  const others = locations.filter((l) => !l.featured);

  return (
    <>
      <PageHero eyebrow="Laamu • Maldives" title="Our home atoll." intro={c["laamu.intro"]} />
      <section className="bg-ink pb-24 text-foam md:pb-32">
        <div className="container-x pt-4">
          {locations.length === 0 ? (
            <EmptyState dark title="Locations coming soon" body="We're mapping out the places we love around Laamu." />
          ) : (
            <>
              {featured.length > 0 && (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {featured.map((l) => (
                    <LocationCard key={l.id} l={l} />
                  ))}
                </div>
              )}
              {others.length > 0 && (
                <div className={featured.length ? "mt-16" : ""}>
                  {featured.length > 0 && <p className="eyebrow mb-8 text-mist">More places</p>}
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {others.map((l) => (
                      <LocationCard key={l.id} l={l} />
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
