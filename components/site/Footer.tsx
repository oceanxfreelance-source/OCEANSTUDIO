import Link from "next/link";
import type { Content } from "@/lib/content";
import { instagramDmUrl, instagramUrl, whatsappUrl } from "@/lib/format";
import { Instagram, Mail, WhatsApp } from "./Icons";
import { Logo } from "./Logo";

export function Footer({ c }: { c: Content }) {
  const ig = instagramUrl(c["social.instagram"]);
  const wa = whatsappUrl(c["contact.whatsapp"]);
  const others = [
    { href: c["social.youtube"], label: "YouTube" },
    { href: c["social.tiktok"], label: "TikTok" },
    { href: c["social.facebook"], label: "Facebook" },
  ].filter((s) => s.href);

  return (
    <footer className="bg-abyss text-foam">
      <div className="container-x grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr] md:py-20">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-mist">{c["footer.text"]}</p>
          <p className="eyebrow mt-6 text-foam/50">{c["hero.location"]}</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-foam/75 md:grid-cols-1">
          <Link href="/work" className="link-underline w-fit hover:text-white">Our Work</Link>
          <Link href="/services" className="link-underline w-fit hover:text-white">Services</Link>
          <Link href="/machines" className="link-underline w-fit hover:text-white">Machines & Maabaidhoo</Link>
          <Link href="/about" className="link-underline w-fit hover:text-white">About</Link>
          <Link href="/contact" className="link-underline w-fit hover:text-white">Contact</Link>
          <Link href="/reviews" className="link-underline w-fit hover:text-white">Reviews</Link>
          {instagramDmUrl(c["social.instagram"]) && (
            <a href={instagramDmUrl(c["social.instagram"])!} target="_blank" rel="noopener noreferrer" className="link-underline w-fit text-gold hover:text-white">
              Book via Instagram
            </a>
          )}
        </nav>
        <div className="space-y-3 text-sm text-foam/75">
          {ig && (
            <a href={ig} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-white">
              <Instagram className="h-4 w-4" /> @{c["social.instagram"].replace(/^@/, "")}
            </a>
          )}
          {c["contact.email"] && (
            <a href={`mailto:${c["contact.email"]}`} className="flex items-center gap-3 break-all hover:text-white">
              <Mail className="h-4 w-4 shrink-0" /> {c["contact.email"]}
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-white">
              <WhatsApp className="h-4 w-4" /> {c["contact.whatsapp"]}
            </a>
          )}
          {others.map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="block hover:text-white">
              {s.label}
            </a>
          ))}
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="container-x flex flex-col gap-2 py-6 text-xs text-foam/40 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} OCEAN X. All rights reserved.</p>
          <p>Maabaidhoo, Laamu Atoll, Maldives</p>
        </div>
      </div>
    </footer>
  );
}
