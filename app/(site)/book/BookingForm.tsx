"use client";

import { useActionState } from "react";
import { TIME_SLOTS } from "@/lib/constants";
import { cx } from "@/components/ui/cx";
import { submitBooking, type BookingState } from "./actions";

type Option = { id: string; name: string; status?: string };

const input =
  "w-full rounded-none border-0 border-b border-deep/20 bg-transparent px-0 py-3 text-base text-deep placeholder:text-slate/60 focus:border-deep focus:outline-none focus:ring-0";

export function BookingForm({
  services,
  locations,
  defaults,
  successMessage,
}: {
  services: Option[];
  locations: Option[];
  defaults: { service?: string; location?: string };
  successMessage: string;
}) {
  const [state, action, pending] = useActionState<BookingState, FormData>(submitBooking, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div role="status" className="border border-deep/10 bg-white/60 p-8 md:p-12">
        <p className="eyebrow text-sea-deep">Request sent</p>
        <p className="display mt-4 text-3xl [font-stretch:112%] md:text-4xl">{successMessage}</p>
        {state.reference && (
          <p className="mt-6 text-sm text-slate">
            Your reference: <span className="font-mono font-semibold text-deep">{state.reference}</span>
          </p>
        )}
      </div>
    );
  }

  const v = state.status === "error" ? state.values : {};
  const fe = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const locationIsListed = !defaults.location || locations.some((l) => l.name === defaults.location);

  return (
    <form action={action} noValidate className="space-y-8">
      {state.status === "error" && (
        <p role="alert" className="border-l-2 border-coral bg-coral/10 px-4 py-3 text-sm text-deep">
          {state.error}
        </p>
      )}

      {/* Honeypot for bots — hidden from people and screen readers */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Field label="Full name" name="fullName" error={fe.fullName} required>
        <input id="fullName" name="fullName" autoComplete="name" required defaultValue={v.fullName} className={input} placeholder="Your name" />
      </Field>

      <div className="grid gap-8 sm:grid-cols-2">
        <Field label="Instagram username" name="instagram" error={fe.instagram}>
          <input id="instagram" name="instagram" autoCapitalize="none" autoCorrect="off" defaultValue={v.instagram} className={input} placeholder="@yourname" />
        </Field>
        <Field label="Email" name="email" error={fe.email}>
          <input id="email" name="email" type="email" autoComplete="email" defaultValue={v.email} className={input} placeholder="you@example.com" />
        </Field>
      </div>

      <Field label="WhatsApp" name="whatsapp" error={fe.whatsapp} hint="Include your country code">
        <input id="whatsapp" name="whatsapp" type="tel" autoComplete="tel" defaultValue={v.whatsapp} className={input} placeholder="+960 …" />
      </Field>

      <div className="grid gap-8 sm:grid-cols-3">
        <Field label="Preferred date" name="preferredDate" error={fe.preferredDate}>
          <input id="preferredDate" name="preferredDate" type="date" defaultValue={v.preferredDate} className={input} />
        </Field>
        <Field label="Preferred time" name="preferredTime" error={fe.preferredTime}>
          <select id="preferredTime" name="preferredTime" defaultValue={v.preferredTime ?? ""} className={input}>
            <option value="">Any time</option>
            {TIME_SLOTS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="People / surfers" name="people" error={fe.people}>
          <input id="people" name="people" type="number" inputMode="numeric" min={1} max={100} defaultValue={v.people} className={input} placeholder="1" />
        </Field>
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <Field label="Service" name="serviceId" error={fe.serviceId}>
          <select id="serviceId" name="serviceId" defaultValue={v.serviceId ?? defaults.service ?? ""} className={input}>
            <option value="">Not sure yet</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.status === "COMING_SOON" ? " (coming soon)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Location" name="location" error={fe.location}>
          {locations.length > 0 && locationIsListed ? (
            <select id="location" name="location" defaultValue={v.location ?? defaults.location ?? ""} className={input}>
              <option value="">Not sure yet</option>
              {locations.map((l) => (
                <option key={l.id} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>
          ) : (
            <input id="location" name="location" defaultValue={v.location ?? defaults.location} className={input} placeholder="e.g. Machines" />
          )}
        </Field>
      </div>

      <Field label="Message" name="message" error={fe.message}>
        <textarea id="message" name="message" rows={4} defaultValue={v.message} className={cx(input, "resize-y")} placeholder="Tell us about your trip, skill level, what you'd like filmed…" />
      </Field>

      <p className="text-xs text-slate">We only use your details to reply to this request.</p>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-abyss px-8 py-5 text-[12px] font-semibold tracking-[0.18em] text-foam transition-colors hover:bg-ink-2 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "SENDING…" : "SEND REQUEST"}
      </button>
    </form>
  );
}

function Field({ label, name, error, hint, required, children }: { label: string; name: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={name} className="eyebrow block text-slate">
        {label}
        {required && <span className="text-coral"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-2 text-sm text-coral" id={`${name}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-2 text-xs text-slate">{hint}</p>
      ) : null}
    </div>
  );
}
