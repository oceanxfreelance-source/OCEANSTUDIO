"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cartTotal, type PriceList } from "@/lib/shop-rules";
import { useCart } from "./cart";

/** Sticky bar at the bottom while there are clips in the cart. */
export function CartBar({ prices }: { prices: PriceList }) {
  const cart = useCart();
  const pathname = usePathname();
  if (!cart.ready || cart.clips.length === 0 || pathname.startsWith("/checkout") || pathname.startsWith("/order") || pathname.startsWith("/book")) return null;
  const { total } = cartTotal(prices, cart.clips, cart.packages);
  const n = cart.clips.length;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gold/30 bg-abyss/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 text-foam backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
        <p className="text-sm">
          <span className="font-semibold">
            {n} clip{n === 1 ? "" : "s"}
          </span>{" "}
          · <span className="text-gold">${total}</span>
        </p>
        <Link href="/checkout" className="rounded-full bg-gold px-6 py-3 text-[12px] font-semibold tracking-[0.16em] text-abyss">
          CHECKOUT →
        </Link>
      </div>
    </div>
  );
}
