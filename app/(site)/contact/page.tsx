import type { Metadata } from "next";
import { ButtonLink } from "@/components/site/Buttons";
import { Instagram, Mail, Pin, WhatsApp } from "@/components/site/Icons";
import { PageHero } from "@/components/site/Section";
import { getContent } from "@/lib/content";
import { instagramUrl, whatsappUrl } from "@/lib/format";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Ocean X at Machines, Maabaidhoo (Laamu, Maldives) — Instagram, email and WhatsApp for surf sessions and collaborations.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const c = await getContent();
  const ig = instagramUrl(c["social.instagram"]);
  const wa = whatsappUrl(c["contact.whatsapp"], "Hi Ocean X!");
  const rows = [
    ig && { icon: Instagram, label: "Instagram", value: `@${c["social.instagram"].replace(/^@/, "")}`, href: ig, external: true },
    c["contact.email"] && { icon: Mail, label: "Email", value: c["contact.email"], href: `mailto:${c["contact.email"]}`, external: false },
    wa && { icon: WhatsApp, label: "WhatsApp", value: c["contact.whatsapp"], href: wa, external: true },
  ].filter(Boolean) as { icon: typeof Mail; label: string; value: string; href: string; external: boolean }[];

  return (
    <>
      <PageHero eyebrow="Contact" title="Let's talk." intro={c["contact.text"]} />
      <section className="bg-paper py-20 md:py-28">
        <div className="container-x grid gap-14 lg:grid-cols-[1fr_1fr] lg:gap-24">
          <div data-reveal>
            <p className="display text-4xl [font-stretch:115%]">OCEAN X</p>
            <p className="mt-3 flex items-center gap-2 text-slate">
              <Pin className="h-4 w-4" /> Machines, Maabaidhoo — Laamu, Maldives
            </p>
            <ul className="mt-10 divide-y divide-deep/10 border-y border-deep/10">
              {rows.map((r) => (
                <li key={r.label}>
                  <a href={r.href} {...(r.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="group flex items-center gap-5 py-5">
                    <r.icon className="h-5 w-5 text-sea-deep" />
                    <span className="flex-1">
                      <span className="eyebrow block text-slate">{r.label}</span>
                      <span className="mt-1 block break-all text-lg">{r.value}</span>
                    </span>
                  </a>
                </li>
              ))}
              {rows.length === 0 && <li className="py-5 text-slate">Use the booking form and we&apos;ll get back to you.</li>}
            </ul>
          </div>
          <div data-reveal className="flex flex-col justify-between bg-abyss p-8 text-foam md:p-12">
            <div>
              <p className="eyebrow text-sea">Book a session</p>
              <p className="display mt-4 text-3xl [font-stretch:112%] md:text-4xl">{c["cta.title"]}</p>
              <p className="mt-4 text-mist">{c["cta.body"]}</p>
            </div>
            <ButtonLink href="/book" arrow className="mt-10 self-start">
              {c["hero.primaryCta"]}
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
