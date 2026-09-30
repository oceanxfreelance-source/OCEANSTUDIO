import type { Metadata } from "next";
import { Instagram, WhatsApp } from "@/components/site/Icons";
import { PageHero } from "@/components/site/Section";
import { getContent } from "@/lib/content";
import { instagramUrl, whatsappUrl } from "@/lib/format";
import { getLocations, getPublicServices } from "@/lib/public";
import { BookingForm } from "./BookingForm";

export const metadata: Metadata = {
  title: "Book a session",
  description: "Request a drone, surf or ocean session with Ocean X at Machines, Maabaidhoo (Laamu, Maldives). No account needed.",
  alternates: { canonical: "/book" },
};

type Props = { searchParams: Promise<{ service?: string; location?: string }> };

export default async function BookPage({ searchParams }: Props) {
  const sp = await searchParams;
  const [c, services, locations] = await Promise.all([getContent(), getPublicServices(), getLocations()]);
  const ig = instagramUrl(c["social.instagram"]);
  const wa = whatsappUrl(c["contact.whatsapp"], "Hi Ocean X! I'd like to book a session.");

  return (
    <>
      <PageHero eyebrow="Book a session" title="Request a session." intro={c["booking.intro"]} />
      <section className="bg-paper py-16 md:py-24">
        <div className="container-x grid gap-16 lg:grid-cols-[1.6fr_1fr] lg:gap-24">
          <BookingForm
            services={services.map((s) => ({ id: s.id, name: s.name, status: s.status }))}
            locations={locations.map((l) => ({ id: l.id, name: l.name }))}
            defaults={{ service: services.some((s) => s.id === sp.service) ? sp.service : undefined, location: sp.location?.slice(0, 120) }}
            successMessage={c["booking.success"]}
          />
          <aside className="space-y-8 lg:pt-2">
            <div>
              <p className="eyebrow text-slate">How it works</p>
              <ol className="mt-5 space-y-4 text-sm leading-relaxed text-slate">
                <li><span className="font-semibold text-deep">1. Send a request</span> — tell us when, where and what you&apos;d like.</li>
                <li><span className="font-semibold text-deep">2. We reply personally</span> — to confirm conditions, timing and price.</li>
                <li><span className="font-semibold text-deep">3. Session day</span> — we shoot; you receive your files by private link.</li>
              </ol>
            </div>
            {(ig || wa) && (
              <div className="border-t border-deep/10 pt-8">
                <p className="eyebrow text-slate">Prefer to message?</p>
                <div className="mt-5 flex flex-col gap-3">
                  {ig && (
                    <a href={ig} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm hover:text-sea-deep">
                      <Instagram className="h-5 w-5" /> Instagram
                    </a>
                  )}
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm hover:text-sea-deep">
                      <WhatsApp className="h-5 w-5" /> WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
