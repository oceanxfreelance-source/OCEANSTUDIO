"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CopyButton } from "@/components/site/shop/CopyButton";
import { cx } from "@/components/ui/cx";
import { BOOKING_PACKAGE_LABEL, SLOT_LABEL, SLOTS, type Slot } from "@/lib/shop-rules";
import { createBooking } from "./actions";

type Pkg = keyof typeof BOOKING_PACKAGE_LABEL;
type Day = { date: string; slots: Record<Slot, { left: number; closed: boolean }> };
type Method = "CASH" | "BANK_TRANSFER";

const PKG_HINT: Record<Pkg, string> = {
  SESSION: "Every clip of you, delivered by private link",
  SESSION_REEL: "All clips + a 30–60 s edited reel with music",
  DRONE_CAMERA: "Drone and camera angles of your session",
};

export function BookingForm({
  days,
  spots,
  packages,
  depositPercent,
  methods,
  bankDetails,
  cashText,
  slotTimes,
}: {
  days: Day[];
  spots: { id: string; name: string }[];
  packages: { id: Pkg; price: number }[];
  depositPercent: number;
  methods: Method[];
  bankDetails: string;
  cashText: string;
  slotTimes: Record<Slot, string>;
}) {
  const router = useRouter();
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [pkg, setPkg] = useState<Pkg>(packages[0]?.id ?? "SESSION");
  const [surfers, setSurfers] = useState(1);
  const [method, setMethod] = useState<Method>(methods[0]!);
  const [showAll, setShowAll] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const price = (packages.find((p) => p.id === pkg)?.price ?? 0) * surfers;
  const deposit = Math.round(price * depositPercent) / 100;
  const visible = showAll ? days : days.slice(0, 14);
  const input = "mt-1.5 block w-full rounded-lg border border-foam/20 bg-ink px-4 py-3 text-foam placeholder:text-foam/35 focus:border-gold focus:outline-none";
  const label = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!date || !slot) {
          setError("Choose a day and session first.");
          return;
        }
        const fd = new FormData(e.currentTarget);
        setError(null);
        setErrors({});
        start(async () => {
          const r = await createBooking({
            date,
            slot,
            locationId: String(fd.get("locationId") ?? ""),
            package: pkg,
            surfers,
            recognition: String(fd.get("recognition") ?? ""),
            name: String(fd.get("name") ?? ""),
            whatsapp: String(fd.get("whatsapp") ?? ""),
            email: String(fd.get("email") ?? ""),
            method,
            note: String(fd.get("note") ?? ""),
            website: String(fd.get("website") ?? ""),
          });
          if ("token" in r) {
            router.push(`/booking/${r.token}?new=1`);
            return;
          }
          setError(r.error);
          setErrors(r.fieldErrors ?? {});
          if (r.fieldErrors?.date) router.refresh();
        });
      }}
      className="grid gap-12 lg:grid-cols-[1.25fr_1fr]"
    >
      <div className="space-y-10">
        <fieldset>
          <legend className="eyebrow text-gold">1 · Day & session</legend>
          <p className="mt-2 text-sm text-mist">
            Morning {slotTimes.MORNING} · Midday {slotTimes.MIDDAY} · Afternoon {slotTimes.AFTERNOON}
          </p>
          <div className="mt-4 divide-y divide-foam/10 border-y border-foam/10">
            {visible.map((d) => (
              <div key={d.date} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 py-2.5">
                <span className={cx("text-sm", date === d.date ? "text-gold" : "text-foam/80")}>{label(d.date)}</span>
                <div className="grid grid-cols-3 gap-2">
                  {SLOTS.map((s) => {
                    const st = d.slots[s];
                    const full = st.closed || st.left <= 0;
                    const active = date === d.date && slot === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={full}
                        aria-pressed={active}
                        aria-label={`${label(d.date)} ${SLOT_LABEL[s]}${full ? " (full)" : ""}`}
                        onClick={() => {
                          setDate(d.date);
                          setSlot(s);
                        }}
                        className={cx(
                          "rounded-full border px-2 py-2 text-[11px] tracking-wide transition-colors",
                          active ? "border-gold bg-gold text-abyss" : full ? "cursor-not-allowed border-foam/5 text-foam/25 line-through" : "border-foam/20 text-foam hover:border-gold/70",
                        )}
                      >
                        {SLOT_LABEL[s]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {!showAll && days.length > 14 && (
            <button type="button" onClick={() => setShowAll(true)} className="mt-3 text-sm text-gold underline">
              Show later dates
            </button>
          )}
          {errors.date && <p className="mt-2 text-xs text-red-300">{errors.date}</p>}
        </fieldset>

        <fieldset>
          <legend className="eyebrow text-gold">2 · Package</legend>
          <div className="mt-4 space-y-2">
            {packages.map((p) => (
              <label key={p.id} className={cx("flex cursor-pointer items-start gap-3 rounded-lg border p-4", pkg === p.id ? "border-gold bg-gold/5" : "border-foam/10")}>
                <input type="radio" name="package" checked={pkg === p.id} onChange={() => setPkg(p.id)} className="mt-1 accent-[#c9a96e]" />
                <span className="flex-1">
                  <span className="flex justify-between gap-3 font-medium">
                    {BOOKING_PACKAGE_LABEL[p.id]} <span className="text-gold">${p.price}</span>
                  </span>
                  <span className="block text-xs text-mist">{PKG_HINT[p.id]} · per surfer</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Surfers
              <select value={surfers} onChange={(e) => setSurfers(Number(e.target.value))} className={input}>
                {Array.from({ length: 6 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Surf spot
              <select name="locationId" className={input}>
                <option value="">Wherever the waves are best</option>
                {spots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-4 block text-sm">
            How do we recognise you?
            <textarea name="recognition" required rows={3} maxLength={500} placeholder="Board colour, rashguard / wetsuit colour, and a name we can shout from the boat" className={input} />
            {errors.recognition && <span className="mt-1 block text-xs text-red-300">{errors.recognition}</span>}
          </label>
        </fieldset>
      </div>

      <div className="space-y-5 lg:sticky lg:top-28 lg:self-start">
        <p className="eyebrow text-gold">3 · Your details</p>
        <div className="border border-foam/10 bg-ink p-5 text-sm">
          <p className="text-mist">{date && slot ? `${label(date)} · ${SLOT_LABEL[slot]}` : "Choose a day and session"}</p>
          <div className="mt-3 flex items-baseline justify-between">
            <span>Total</span>
            <span className="display text-3xl text-gold">${price}</span>
          </div>
          {depositPercent > 0 && (
            <p className="mt-1 flex justify-between text-mist">
              <span>Deposit now ({depositPercent}%)</span>
              <span>${deposit}</span>
            </p>
          )}
          <p className="mt-1 text-xs text-mist">The rest is paid when your clips are ready.</p>
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
        <fieldset className="space-y-2">
          <legend className="text-sm">Deposit payment</legend>
          {methods.map((m) => (
            <label key={m} className={cx("block cursor-pointer rounded-lg border p-4", method === m ? "border-gold bg-gold/5" : "border-foam/10")}>
              <span className="flex items-center gap-3 text-sm font-medium">
                <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} className="accent-[#c9a96e]" />
                {m === "BANK_TRANSFER" ? "USD bank transfer" : "Cash on the island"}
              </span>
              {method === m && m === "BANK_TRANSFER" && (
                <span className="mt-3 block rounded bg-abyss p-3 text-xs">
                  <span className="block whitespace-pre-line font-mono">{bankDetails}</span>
                  <span className="mt-2 flex justify-end">
                    <CopyButton text={bankDetails} label="Copy details" className="rounded-full border border-gold/60 px-3 py-1 text-[10px] font-semibold tracking-[0.14em] text-gold" />
                  </span>
                </span>
              )}
              {method === m && m === "CASH" && <span className="mt-2 block text-xs text-mist">{cashText}</span>}
            </label>
          ))}
        </fieldset>
        <label className="block text-sm">
          Note <span className="text-mist">(optional)</span>
          <textarea name="note" rows={2} maxLength={1000} className={input} />
        </label>
        {error && <p className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        <button disabled={pending} className="w-full rounded-full bg-gold py-4 text-[12px] font-semibold tracking-[0.16em] text-abyss disabled:opacity-60">
          {pending ? "SENDING…" : "REQUEST BOOKING"}
        </button>
        <p className="text-xs text-mist">We confirm on WhatsApp. If the waves or wind change, we may move your session — you&apos;ll see it on your booking page.</p>
      </div>
    </form>
  );
}
