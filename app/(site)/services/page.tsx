import type { Metadata } from "next";
import { ButtonLink } from "@/components/site/Buttons";
import { ServiceCard } from "@/components/site/Cards";
import { EmptyState, PageHero } from "@/components/site/Section";
import { getContent } from "@/lib/content";
import { getPublicServices } from "@/lib/public";

export const metadata: Metadata = {
  title: "Services",
  description: "Drone videography, surf films and ocean photography at Machines, Maabaidhoo (Laamu, Maldives) — see what Ocean X offers now and what's coming soon.",
  alternates: { canonical: "/services" },
};

export default async function ServicesPage() {
  const [c, services] = await Promise.all([getContent(), getPublicServices()]);
  const active = services.filter((s) => s.status === "ACTIVE");
  const soon = services.filter((s) => s.status === "COMING_SOON");

  return (
    <>
      <PageHero eyebrow="Services" title="What we create." intro={c["services.intro"]} />
      <section className="bg-paper py-20 md:py-28">
        <div className="container-x">
          {services.length === 0 && <EmptyState title="Services coming soon" body="We're preparing our service list. Get in touch in the meantime." />}
          {active.length > 0 && (
            <>
              <p className="eyebrow text-sea-deep">Available now</p>
              <div className="mt-8 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((s, i) => (
                  <ServiceCard key={s.id} s={s} index={i} />
                ))}
              </div>
            </>
          )}
          {soon.length > 0 && (
            <div className={active.length ? "mt-24" : ""}>
              <p className="eyebrow text-slate">Coming soon</p>
              <div className="mt-8 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                {soon.map((s) => (
                  <ServiceCard key={s.id} s={s} />
                ))}
              </div>
            </div>
          )}
          <div className="mt-24 flex flex-col items-start justify-between gap-6 border-t border-deep/10 pt-10 md:flex-row md:items-center">
            <p className="max-w-xl text-lg text-slate">Have a project that isn&apos;t listed — a resort, a brand, an event? Tell us about it.</p>
            <ButtonLink href="/book" variant="dark" arrow>
              SEND A REQUEST
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
