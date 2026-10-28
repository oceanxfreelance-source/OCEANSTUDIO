import Link from "next/link";
import type { Content } from "@/lib/content";
import { instagramUrl, whatsappUrl } from "@/lib/format";
import { Instagram, Mail, WhatsApp } from "./Icons";
import { Logo } from "./Logo";

/** Quiet footer: logo, a few links, ways to reach us, and the filming notice. */
export function Footer({ c }: { c: Content }) {
  const ig = instagramUrl(c["social.instagram"]);
  const wa = whatsappUrl(c["contact.whatsapp"]);
  const links = [
    { href: "/clips", label: "Find my clips" },
    { href: "/book", label: "Book a session" },
    { href: "/work", label: "Our work" },
    { href: "/reviews", label: "Reviews" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <footer className="bg-abyss text-foam">
      <div className="container-x flex flex-col gap-8 py-14 md:flex-row md:items-start md:justify-between">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-mist">Machines · Maabaidhoo · Laamu, Maldives</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm text-foam/75 sm:grid-cols-3">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="w-fit hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>
        {(ig || wa || c["contact.email"]) && (
          <div className="flex gap-3">
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="flex h-10 w-10 items-center justify-center rounded-full border border-foam/20 hover:border-gold hover:text-gold">
                <WhatsApp className="h-4 w-4" />
              </a>
            )}
            {ig && (
              <a href={ig} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="flex h-10 w-10 items-center justify-center rounded-full border border-foam/20 hover:border-gold hover:text-gold">
                <Instagram className="h-4 w-4" />
              </a>
            )}
            {c["contact.email"] && (
              <a href={`mailto:${c["contact.email"]}`} aria-label="Email" className="flex h-10 w-10 items-center justify-center rounded-full border border-foam/20 hover:border-gold hover:text-gold">
                <Mail className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
      </div>
      <div className="border-t border-white/5">
        <div className="container-x flex flex-col gap-3 py-6 text-xs text-foam/45 md:flex-row md:justify-between">
          <p>
            We film surfers at the break. Not happy to be in the gallery?{" "}
            <Link href="/remove" className="text-gold/80 underline hover:text-gold">
              Remove my clip
            </Link>
          </p>
          <p>© {new Date().getFullYear()} OCEAN X</p>
        </div>
      </div>
    </footer>
  );
}
