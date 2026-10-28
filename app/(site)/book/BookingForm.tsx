"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PaymentChoice } from "@/components/site/shop/PaymentChoice";
import type { PayMethod } from "@/lib/shop-rules";
import { cx } from "@/components/ui/cx";
import { BOOKING_PACKAGE_LABEL, SLOT_LABEL, SLOTS, type Slot } from "@/lib/shop-rules";
import { createBooking } from "./actions";

type Pkg = keyof typeof BOOKING_PACKAGE_LABEL;
type Day = { date: string; slots: Record<Slot, { left: number; closed: boolean }> };
type Method = PayMethod;

const PKG_HINT: Record<Pkg, string> = {
  SESSION: "Every clip of you, delivered by private link",
  SESSION_REEL: "All clips + a 30–60 s edited reel with music",
  DRONE_CAMERA: "Drone and camera angles of your session",
};

export function BookingForm({
  days,
  packages,
  depositPercent,
  methods,
  bankDetails,
  cashText,
  slotTimes,
}: {
  days: Day[];
  packages: { id: Pkg; price: number }[];
  depositPercent: number;
  methods: Method[];
  bankDetails: string;
  cashText: string;
  slotTimes: Record<Slot, string>;
}) {
  const router = useRouter();
  const firstOpen = days.find((d) => SLOTS.some((s) => !d.slots[s].closed && d.slots[s].left > 0))?.date ?? null;
  const [date, setDate] = useState<string | null>(firstOpen);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [pkg, setPkg] = useState<Pkg>(packages[0]?.id ?? "SESSION");
  const [surfers, setSurfers] = useState(1);
  const [method, setMethod] = useState<Method>(methods[0]!);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const price = (packages.find((p) => p.id === pkg)?.price ?? 0) * surfers;
  const deposit = Math.round(price * depositPercent) / 100;
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
            package: pkg,
            surfers,
            recognition: String(fd.get("recognition") ?? ""),
            name: String(fd.get("name") ?? ""),
            whatsapp: String(fd.get("whatsapp") ?? ""),
            email: String(fd.get("email") ?? ""),
            method,
            note: String(fd.get("note") ?? ""),
            guide: String(fd.get("guide") ?? ""),
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
      <div className="min-w-0 space-y-10">
        <fieldset className="min-w-0">
          <legend className="text-lg font-medium">
            <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-gold text-sm text-abyss">1</span>Choose a day
          </legend>
          <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {days.map((d) => {
              const open = SLOTS.some((s) => !d.slots[s].closed && d.slots[s].left > 0);
              const dt = new Date(`${d.date}T00:00:00Z`);
              const active = date === d.date;
              return (
                <button
                  key={d.date}
                  type="button"
                  disabled={!open}
                  aria-pressed={active}
                  aria-label={`${label(d.date)}${open ? "" : " (full)"}`}
                  onClick={() => {
                    setDate(d.date);
                    if (slot && (d.slots[slot].closed || d.slots[slot].left <= 0)) setSlot(null);
                  }}
                  className={cx(
                    "flex w-16 shrink-0 flex-col items-center rounded-2xl border py-3 transition-colors",
                    active ? "border-gold bg-gold text-abyss" : open ? "border-foam/15 text-foam hover:border-gold/60" : "cursor-not-allowed border-foam/5 text-foam/25",
                  )}
                >
                  <span className="text-[11px] uppercase tracking-wide opacity-75">{dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</span>
                  <span className="display text-2xl">{dt.getUTCDate()}</span>
                  <span className="text-[11px] opacity-75">{dt.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</span>
                </button>
              );
            })}
          </div>

          <p className="mt-8 text-lg font-medium">
            <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-gold text-sm text-abyss">2</span>Choose a session
          </p>
          {date ? (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {SLOTS.map((s) => {
                const st = days.find((d) => d.date === date)!.slots[s];
                const full = st.closed || st.left <= 0;
                const active = slot === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={full}
                    aria-pressed={active}
                    aria-label={`${label(date)} ${SLOT_LABEL[s]}${full ? " (full)" : ""}`}
                    onClick={() => setSlot(s)}
                    className={cx(
                      "rounded-2xl border p-3 text-left transition-colors sm:p-4",
                      active ? "border-gold bg-gold/10" : full ? "cursor-not-allowed border-foam/5 opacity-40" : "border-foam/15 hover:border-gold/60",
                    )}
                  >
                    <span className="block font-medium">{SLOT_LABEL[s]}</span>
                    <span className="block text-xs text-mist">{slotTimes[s]}</span>
                    <span className={cx("mt-2 block text-xs", full ? "text-foam/50" : "text-gold")}>{full ? "Full" : st.left === 1 ? "1 place left" : `${st.left} places`}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-mist">Pick a day first.</p>
          )}
          {errors.date && <p className="mt-2 text-xs text-red-300">{errors.date}</p>}
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="text-lg font-medium">
            <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-gold text-sm text-abyss">3</span>Package & how to spot you
          </legend>
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
            <div className="block text-sm">
              Where
              <p className="mt-1.5 rounded-lg border border-foam/10 px-4 py-3 text-foam/85">Machines, Maabaidhoo</p>
            </div>
          </div>
          <label className="mt-4 block text-sm">
            How do we recognise you?
            <textarea name="recognition" required rows={3} maxLength={500} placeholder="Board colour, rashguard / wetsuit colour, and a name we can shout from the boat" className={input} />
            {errors.recognition && <span className="mt-1 block text-xs text-red-300">{errors.recognition}</span>}
          </label>
        </fieldset>
      </div>

      <div className="min-w-0 space-y-5 lg:sticky lg:top-28 lg:self-start">
        <p className="text-lg font-medium">
          <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-gold text-sm text-abyss">4</span>Your details
        </p>
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
        <PaymentChoice methods={methods} method={method} onChange={setMethod} bankDetails={bankDetails} cashText={cashText} guideError={errors.guide} legend="Deposit payment" />
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
