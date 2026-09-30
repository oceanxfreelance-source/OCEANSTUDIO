"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui/cx";
import { Close, Instagram, Menu } from "./Icons";
import { Logo } from "./Logo";

// Public navigation only. The Superadmin is intentionally NOT linked anywhere.
const NAV = [
  { href: "/work", label: "Our Work" },
  { href: "/services", label: "Services" },
  { href: "/laamu", label: "Laamu" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Header({ instagramUrl }: { instagramUrl: string | null }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  // Pages with a dark full-bleed hero start with a transparent header.
  const overlay = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const solid = scrolled || !overlay || open;

  return (
    <header
      className={cx(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500",
        solid ? "border-b border-white/5 bg-abyss/85 backdrop-blur-xl" : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="container-x flex h-16 items-center justify-between text-foam md:h-20">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cx(
                "text-[13px] tracking-wide transition-colors hover:text-white",
                pathname.startsWith(n.href) ? "text-white" : "text-foam/70",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {instagramUrl && (
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Ocean X on Instagram" className="hidden rounded-full p-2 text-foam/80 hover:text-white sm:inline-flex">
              <Instagram className="h-5 w-5" />
            </a>
          )}
          <Link
            href="/book"
            className="hidden rounded-full bg-foam px-5 py-2.5 text-[12px] font-semibold tracking-[0.14em] text-abyss transition-colors hover:bg-white sm:inline-flex"
          >
            BOOK A SESSION
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="-mr-2 rounded-full p-2 lg:hidden"
          >
            {open ? <Close className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        hidden={!open}
        className="h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/5 bg-abyss px-5 pb-10 pt-6 text-foam lg:hidden"
      >
        <nav aria-label="Mobile" className="flex flex-col">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="display border-b border-white/5 py-5 text-3xl [font-stretch:110%]">
              {n.label}
            </Link>
          ))}
        </nav>
        <Link href="/book" className="mt-8 flex items-center justify-center rounded-full bg-foam py-4 text-sm font-semibold tracking-[0.14em] text-abyss">
          BOOK A SESSION
        </Link>
        {instagramUrl && (
          <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="mt-6 flex items-center justify-center gap-2 text-sm text-foam/70">
            <Instagram className="h-5 w-5" /> Follow on Instagram
          </a>
        )}
      </div>
    </header>
  );
}
