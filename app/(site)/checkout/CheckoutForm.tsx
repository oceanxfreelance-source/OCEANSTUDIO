"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useCart } from "@/components/site/shop/cart";
import { PaymentChoice } from "@/components/site/shop/PaymentChoice";
import type { PayMethod } from "@/lib/shop-rules";
import { cx } from "@/components/ui/cx";
import { cartTotal, ORDER_PACKAGE_LABEL, SLOT_LABEL, type PriceList, type SessionPackage, type Slot } from "@/lib/shop-rules";
import { placeOrder } from "./actions";

type Method = PayMethod;

export function CheckoutForm({ prices, methods, bankDetails, cashText }: { prices: PriceList; methods: Method[]; bankDetails: string; cashText: string }) {
  const cart = useCart();
  const router = useRouter();
  const [method, setMethod] = useState<Method>(methods[0]!);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { sessions, total } = cartTotal(prices, cart.clips, cart.packages);

  if (!cart.ready) return <p className="text-mist">Loading your cart…</p>;
  if (cart.clips.length === 0)
    return (
      <div className="border border-foam/10 p-8 text-center">
        <p className="text-mist">Your cart is empty.</p>
        <Link href="/clips" className="mt-5 inline-block rounded-full bg-gold px-7 py-3.5 text-[12px] font-semibold tracking-[0.16em] text-abyss">
          FIND YOUR CLIPS
        </Link>
      </div>
    );

  const input = "mt-1.5 block w-full rounded-lg border border-foam/20 bg-ink px-4 py-3 text-foam placeholder:text-foam/35 focus:border-gold focus:outline-none";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        setErrors({});
        start(async () => {
          const r = await placeOrder({
            clipIds: cart.clips.map((c) => c.id),
            packages: cart.packages,
            name: String(fd.get("name") ?? ""),
            whatsapp: String(fd.get("whatsapp") ?? ""),
            email: String(fd.get("email") ?? ""),
            method,
            note: String(fd.get("note") ?? ""),
            website: String(fd.get("website") ?? ""),
          });
          if ("token" in r) {
            cart.clear();
            router.push(`/order/${r.token}?new=1`);
            return;
          }
          if (r.missing) r.missing.forEach((id) => cart.remove(id));
          setError(r.error);
          setErrors(r.fieldErrors ?? {});
        });
      }}
      className="grid gap-10 lg:grid-cols-[1.2fr_1fr]"
    >
      <div className="space-y-6">
        {sessions.map((s) => {
          const first = s.items[0]!;
          return (
            <section key={s.key} className="border border-foam/10 bg-ink p-5">
              <h2 className="text-[11px] uppercase tracking-[0.18em] text-mist">
                {first.spotName} · {SLOT_LABEL[first.slot as Slot] ?? first.slot} · {new Date(`${first.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
              </h2>
              <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {s.items.map((c) => (
                  <li key={c.id} className="relative">
                    <span className="block aspect-[4/5] overflow-hidden bg-abyss">
                      {c.poster && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.poster} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="mt-1 block truncate font-mono text-[10px] text-mist">{c.code}</span>
                    <button type="button" onClick={() => cart.remove(c.id)} aria-label={`Remove ${c.code}`} className="absolute right-1 top-1 h-6 w-6 rounded-full bg-abyss/80 text-xs text-foam">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <fieldset className="mt-5 space-y-2">
                <legend className="sr-only">Package for this session</legend>
                {((s.capped ? ["SESSION", "SESSION_REEL"] : ["CLIPS", "SESSION", "SESSION_REEL"]) as SessionPackage[]).map((pkg) => {
                  const price = pkg === "CLIPS" ? s.items.length * prices.clip : pkg === "SESSION" ? prices.session : prices.reel;
                  const hint =
                    pkg === "CLIPS"
                      ? `${s.items.length} × $${prices.clip}`
                      : pkg === "SESSION"
                        ? s.capped
                          ? `${s.items.length} clips reach the session price — you get every clip of you that session`
                          : "Every clip of you that session — we add any you missed"
                        : "All your clips + a 30–60 s edited reel with music";
                  return (
                    <label key={pkg} className={cx("flex cursor-pointer items-start gap-3 rounded-lg border p-3", s.pkg === pkg ? "border-gold bg-gold/5" : "border-foam/10")}>
                      <input type="radio" name={`pkg-${s.key}`} checked={s.pkg === pkg} onChange={() => cart.setPackage(s.key, pkg)} className="mt-1 accent-[#c9a96e]" />
                      <span className="flex-1">
                        <span className="flex justify-between gap-3 text-sm font-medium">
                          {ORDER_PACKAGE_LABEL[pkg]} <span className="text-gold">${price}</span>
                        </span>
                        <span className="block text-xs text-mist">{hint}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            </section>
          );
        })}
        <Link href="/clips" className="inline-block text-sm text-gold underline">
          ← Add more clips
        </Link>
      </div>

      <div className="space-y-6 lg:sticky lg:top-28 lg:self-start">
        <div className="border border-foam/10 bg-ink p-5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-mist">Total</span>
            <span className="display text-4xl text-gold">${total}</span>
          </div>
        </div>
        <label className="block text-sm">
          Your name
          <input name="name" required maxLength={100} autoComplete="name" className={input} />
          {errors.name && <span className="mt-1 block text-xs text-red-300">{errors.name}</span>}
        </label>
        <label className="block text-sm">
          WhatsApp number
          <input name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="+44 7…" maxLength={30} className={input} />
          {errors.whatsapp && <span className="mt-1 block text-xs text-red-300">{errors.whatsapp}</span>}
        </label>
        <label className="block text-sm">
          Email <span className="text-mist">(or WhatsApp)</span>
          <input name="email" type="email" autoComplete="email" maxLength={200} className={input} />
          {errors.email && <span className="mt-1 block text-xs text-red-300">{errors.email}</span>}
        </label>
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

        <PaymentChoice methods={methods} method={method} onChange={setMethod} bankDetails={bankDetails} cashText={cashText} legend="How will you pay?" />
        <label className="block text-sm">
          Note <span className="text-mist">(optional)</span>
          <textarea name="note" rows={2} maxLength={1000} placeholder="Anything we should know — e.g. the clips of your friend too" className={input} />
        </label>
        {error && <p className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        <button disabled={pending} className="w-full rounded-full bg-gold py-4 text-[12px] font-semibold tracking-[0.16em] text-abyss disabled:opacity-60">
          {pending ? "PLACING ORDER…" : `PLACE ORDER · $${total}`}
        </button>
        <p className="text-xs text-mist">You&apos;ll get a private page to follow your order. Downloads open as soon as we confirm your payment.</p>
      </div>
    </form>
  );
}
