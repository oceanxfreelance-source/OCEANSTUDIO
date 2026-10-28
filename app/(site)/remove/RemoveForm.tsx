"use client";

import { useActionState } from "react";
import { requestRemoval, type RemoveState } from "./actions";

export function RemoveForm({ code }: { code?: string }) {
  const [state, action, pending] = useActionState<RemoveState, FormData>(requestRemoval, { status: "idle" });
  if (state.status === "sent")
    return (
      <p className="rounded border border-gold/40 bg-gold/10 p-5 text-foam">
        {state.hidden ? "Done — the clip has been taken out of the gallery. " : "Thanks — we've received your request. "}
        We&apos;ll check it and remove it for good. Sorry for the trouble.
      </p>
    );
  const input = "mt-1.5 block w-full rounded-lg border border-foam/20 bg-ink px-4 py-3 text-foam placeholder:text-foam/35 focus:border-gold focus:outline-none";
  return (
    <form action={action} className="space-y-5">
      <label className="block text-sm">
        Clip code
        <input name="code" required defaultValue={code} placeholder="e.g. MC-2710-07" autoCapitalize="characters" className={`${input} font-mono uppercase`} />
      </label>
      <label className="block text-sm">
        Reason <span className="text-mist">(optional)</span>
        <textarea name="reason" rows={3} maxLength={1000} placeholder="e.g. It's me and I don't want to be in the gallery / it shows my child" className={input} />
      </label>
      <label className="block text-sm">
        Your WhatsApp or email <span className="text-mist">(optional, if you&apos;d like a reply)</span>
        <input name="contact" maxLength={200} className={input} />
      </label>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {state.status === "error" && <p className="text-sm text-red-300">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-full bg-gold py-4 text-[12px] font-semibold tracking-[0.16em] text-abyss disabled:opacity-60">
        {pending ? "SENDING…" : "REMOVE MY CLIP"}
      </button>
    </form>
  );
}
