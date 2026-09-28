"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { cx } from "@/components/ui";

const NAV: { section?: string; items: { href: string; label: string }[] }[] = [
  { items: [{ href: "/admin", label: "Dashboard" }] },
  { items: [{ href: "/admin/projects", label: "Projects" }, { href: "/admin/clients", label: "Clients" }] },
  { items: [{ href: "/admin/photo-ai", label: "AI Photo" }, { href: "/admin/video-ai", label: "AI Video" }, { href: "/admin/color", label: "Color Grade" }] },
  {
    items: [
      { href: "/admin/processing", label: "Processing" },
      { href: "/admin/deliveries", label: "Deliveries" },
      { href: "/admin/downloads", label: "Downloads" },
      { href: "/admin/storage", label: "Storage" },
    ],
  },
  { items: [{ href: "/admin/settings", label: "Settings" }] },
];

export function Sidebar({ adminName }: { adminName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  return (
    <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col border-r border-ink-700 bg-ink-950">
      <div className="px-6 pb-6 pt-7">
        <Link href="/admin" className="block">
          <span className="text-[13px] font-bold tracking-[0.32em] text-mist-100">OCEANX</span>
          <span className="ml-2 text-[13px] font-light tracking-[0.32em] text-mist-400">STUDIO</span>
        </Link>
      </div>
      <nav aria-label="Admin" className="flex-1 space-y-5 overflow-y-auto px-3">
        {NAV.map((group, i) => (
          <ul key={i} className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active(item.href) ? "page" : undefined}
                  className={cx(
                    "flex items-center rounded-lg px-3 py-2 text-[13px] transition-colors",
                    active(item.href) ? "bg-ink-800 font-medium text-mist-100" : "text-mist-400 hover:bg-ink-850 hover:text-mist-200",
                  )}
                >
                  <span className={cx("mr-3 h-4 w-0.5 rounded-full", active(item.href) ? "bg-ocean-400" : "bg-transparent")} aria-hidden />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        ))}
      </nav>
      <div className="border-t border-ink-700 px-5 py-4">
        <p className="truncate text-xs text-mist-300">{adminName}</p>
        <button
          className="mt-1 text-xs text-mist-400 hover:text-mist-100"
          onClick={async () => {
            await api("/api/admin/auth/logout", { method: "POST", body: {} });
            router.replace("/admin/login");
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
