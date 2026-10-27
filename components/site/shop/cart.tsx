"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartClip, SessionPackage } from "@/lib/shop-rules";

/**
 * The clip cart lives in the browser (no account). It only holds clip ids and
 * display info — prices are always recalculated on the server at checkout.
 */
type Cart = {
  clips: CartClip[];
  packages: Record<string, SessionPackage>;
  ready: boolean;
  has: (id: string) => boolean;
  toggle: (c: CartClip) => void;
  remove: (id: string) => void;
  setPackage: (key: string, p: SessionPackage) => void;
  clear: () => void;
};

const KEY = "oceanx-cart-v1";
const CartContext = createContext<Cart | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [clips, setClips] = useState<CartClip[]>([]);
  const [packages, setPackages] = useState<Record<string, SessionPackage>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { clips?: CartClip[]; packages?: Record<string, SessionPackage> } | null;
      if (saved?.clips) setClips(saved.clips.slice(0, 100));
      if (saved?.packages) setPackages(saved.packages);
    } catch {
      /* storage unavailable — cart works for this visit only */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ clips, packages }));
    } catch {
      /* ignore */
    }
  }, [clips, packages, ready]);

  const has = useCallback((id: string) => clips.some((c) => c.id === id), [clips]);
  const toggle = useCallback((c: CartClip) => setClips((cs) => (cs.some((x) => x.id === c.id) ? cs.filter((x) => x.id !== c.id) : [...cs, c].slice(0, 100))), []);
  const remove = useCallback((id: string) => setClips((cs) => cs.filter((x) => x.id !== id)), []);
  const setPackage = useCallback((key: string, p: SessionPackage) => setPackages((ps) => ({ ...ps, [key]: p })), []);
  const clear = useCallback(() => {
    setClips([]);
    setPackages({});
  }, []);

  const value = useMemo(() => ({ clips, packages, ready, has, toggle, remove, setPackage, clear }), [clips, packages, ready, has, toggle, remove, setPackage, clear]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): Cart {
  const c = useContext(CartContext);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}
