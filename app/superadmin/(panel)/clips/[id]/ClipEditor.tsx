"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateClip } from "../actions";

/** Edit a clip's surfer description, booking and visibility; remake its preview. */
export function ClipEditor({ clip, bookings }: { clip: { id: string; description: string; bookingId: string | null; hidden: boolean; status: string }; bookings: { id: string; label: string }[] }) {
  const router = useRouter();
  const [description, setDescription] = useState(clip.description);
  const [bookingId, setBookingId] = useState(clip.bookingId ?? "");
  const [hidden, setHidden] = useState(clip.hidden);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [remaking, setRemaking] = useState(false);

  return (
    <div className="space-y-5">
      <label className="block text-sm font-medium">
        Surfer description
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="e.g. red board, black rashguard" className="mt-1 block w-full rounded-lg border border-slate/30 px-3 py-2.5 text-sm" />
        <span className="mt-1 block text-xs text-slate">Guests search for this in the gallery.</span>
      </label>
      <label className="block text-sm font-medium">
        This clip is for
        <select value={bookingId} onChange={(e) => setBookingId(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate/30 bg-white px-3 py-2.5 text-sm">
          <option value="">Public gallery (anyone can buy)</option>
          {bookings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-slate">A clip for a booking appears only on that surfer&apos;s private page.</span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} className="mt-0.5 h-4 w-4" />
        <span>
          <span className="font-medium">Hidden</span>
          <span className="block text-xs text-slate">Not shown publicly — e.g. a removal request, or a child without a parent&apos;s OK.</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await updateClip(clip.id, { description, bookingId: bookingId || null, hidden });
              setMsg(r.ok ? "Saved." : (r.error ?? "Could not save"));
              router.refresh();
            })
          }
          className="rounded-lg bg-abyss px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={remaking}
          onClick={async () => {
            setRemaking(true);
            setMsg(null);
            const res = await fetch("/api/admin/clips/process", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: clip.id }) });
            const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
            setMsg(j.ok ? "Preview remade." : (j.error ?? "Preview failed"));
            setRemaking(false);
            router.refresh();
          }}
          className="rounded-lg border border-slate/30 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-foam disabled:opacity-60"
        >
          {remaking ? "Making preview…" : clip.status === "READY" ? "Remake preview" : "Make preview"}
        </button>
        {msg && <span className="text-sm text-slate">{msg}</span>}
      </div>
    </div>
  );
}
