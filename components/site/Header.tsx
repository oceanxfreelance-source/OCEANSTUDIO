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
  { href: "/machines", label: "Machines" },
  { href: "/reviews", label: "Reviews" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Header({ instagramUrl, bookUrl }: { instagramUrl: string | null; bookUrl: string | null }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  // Pages with a dark full-bleed hero start with a transparent header.
  const overlay = pathname === "/";

  useEffect(() => {
    // Solid background once scrolled; slide away while scrolling down and
    // come back as soon as the visitor scrolls up.
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      if (Math.abs(y - last) > 6) {
        setHidden(y > last && y > 160);
        last = y;
      }
    };
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
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        hidden && !open && "header-hidden",
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
              aria-current={pathname.startsWith(n.href) ? "page" : undefined}
              className={cx(
                "link-underline text-[13px] tracking-wide hover:text-white",
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
          {bookUrl ? (
            <a
              href={bookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-lift hidden items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-[12px] font-semibold tracking-[0.14em] text-abyss hover:bg-[#d8bc86] sm:inline-flex"
            >
              <Instagram className="h-4 w-4" /> BOOK VIA INSTAGRAM
            </a>
          ) : (
            <Link
              href="/reviews#leave-a-review"
              className="btn-lift hidden rounded-full bg-foam px-5 py-2.5 text-[12px] font-semibold tracking-[0.14em] text-abyss hover:bg-white sm:inline-flex"
            >
              LEAVE A REVIEW
            </Link>
          )}
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
            <Link key={n.href} href={n.href} className="display border-b border-white/5 py-5 text-3xl transition-[padding,color] duration-300 [font-stretch:110%] hover:pl-2 hover:text-gold">
              {n.label}
            </Link>
          ))}
        </nav>
        {bookUrl && (
          <a href={bookUrl} target="_blank" rel="noopener noreferrer" className="mt-8 flex items-center justify-center gap-2 rounded-full bg-gold py-4 text-sm font-semibold tracking-[0.14em] text-abyss">
            <Instagram className="h-4 w-4" /> BOOK VIA INSTAGRAM
          </a>
        )}
        <Link
          href="/reviews#leave-a-review"
          onClick={() => setOpen(false)}
          className={cx("flex items-center justify-center rounded-full py-4 text-sm font-semibold tracking-[0.14em]", bookUrl ? "mt-3 border border-foam/30 text-foam" : "mt-8 bg-foam text-abyss")}
        >
          LEAVE A REVIEW
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
