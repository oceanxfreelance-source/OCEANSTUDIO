"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui/cx";

const GROUPS = [
  {
    label: "Business",
    items: [
      { href: "/superadmin", label: "Dashboard", exact: true },
      { href: "/superadmin/bookings", label: "Bookings" },
      { href: "/superadmin/sessions", label: "Sessions & delivery" },
      { href: "/superadmin/customers", label: "Customers" },
    ],
  },
  {
    label: "Website",
    items: [
      { href: "/superadmin/services", label: "Services" },
      { href: "/superadmin/portfolio", label: "Portfolio" },
      { href: "/superadmin/locations", label: "Locations" },
      { href: "/superadmin/testimonials", label: "Testimonials" },
      { href: "/superadmin/content", label: "Website content" },
    ],
  },
];

export function AdminNav({ newBookings, onLogout, adminName }: { newBookings: number; onLogout: () => Promise<void>; adminName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <nav className="flex flex-col gap-6">
      {GROUPS.map((g) => (
        <div key={g.label}>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-foam/40">{g.label}</p>
          <ul className="mt-2 space-y-0.5">
            {g.items.map((it) => {
              const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={cx("flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors", active ? "bg-white/10 text-white" : "text-foam/70 hover:bg-white/5 hover:text-white")}
                  >
                    {it.label}
                    {it.href === "/superadmin/bookings" && newBookings > 0 && (
                      <span className="rounded-full bg-sea px-2 py-0.5 text-[11px] font-semibold text-abyss">{newBookings}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="border-t border-white/10 pt-4">
        <Link href="/superadmin/account" className="block rounded-lg px-3 py-2 text-sm text-foam/70 hover:bg-white/5 hover:text-white">
          Account · {adminName}
        </Link>
        <Link href="/" target="_blank" className="block rounded-lg px-3 py-2 text-sm text-foam/70 hover:bg-white/5 hover:text-white">
          View website ↗
        </Link>
        <form action={onLogout}>
          <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm text-foam/70 hover:bg-white/5 hover:text-white">
            Log out
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col overflow-y-auto bg-abyss px-4 py-6 text-foam lg:flex">
        <Brand />
        <div className="mt-8">{nav}</div>
      </aside>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between bg-abyss px-4 text-foam lg:hidden">
        <Brand />
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="rounded-lg px-3 py-1.5 text-sm ring-1 ring-white/20">
          {open ? "Close" : "Menu"}
          {!open && newBookings > 0 && <span className="ml-2 rounded-full bg-sea px-1.5 text-[11px] font-semibold text-abyss">{newBookings}</span>}
        </button>
      </div>
      {open && <div className="fixed inset-x-0 bottom-0 top-14 z-40 overflow-y-auto bg-abyss px-4 py-6 text-foam lg:hidden">{nav}</div>}
    </>
  );
}

function Brand() {
  return (
    <Link href="/superadmin" className="flex items-baseline gap-2 px-3">
      <span className="display text-base tracking-[0.18em] [font-stretch:125%]">
        OCEAN<span className="ml-[0.35em] text-sea">X</span>
      </span>
      <span className="text-[10px] uppercase tracking-[0.2em] text-foam/40">Admin</span>
    </Link>
  );
}
