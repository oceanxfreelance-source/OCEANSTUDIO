"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";
import { createClip, updateClip } from "@/app/superadmin/(panel)/clips/actions";
import { SLOT_LABEL, SLOTS, type Slot } from "@/lib/shop-rules";
import { checkVideoFile } from "./video-client";

type Spot = { id: string; name: string; code: string };
type BookingOption = { id: string; label: string; date: string | null; slot: Slot | null };
type Row = {
  key: string;
  name: string;
  status: "waiting" | "uploading" | "processing" | "ready" | "failed";
  progress: number;
  clipId?: string;
  code?: string;
  description: string;
  bookingId: string;
  error?: string;
};

/**
 * Upload a whole session at once: pick date, spot and time of day, then many
 * clips from the gallery. Each original goes to PRIVATE storage, gets its code
 * (e.g. MC-2710-07) and a watermarked preview. Clips can be given a surfer
 * description and assigned to a booking (private) or left for the public gallery.
 */
export function ClipUploader({
  spots,
  bookings,
  driver,
  initial,
}: {
  spots: Spot[];
  bookings: BookingOption[];
  driver: "vercel" | "local";
  initial: { date: string; slot: Slot; spotId: string | null; bookingId: string };
}) {
  const [date, setDate] = useState(initial.date);
  const [slot, setSlot] = useState<Slot>(initial.slot);
  const [spotId, setSpotId] = useState(initial.spotId ?? spots[0]?.id ?? "");
  const [batchBooking, setBatchBooking] = useState(initial.bookingId);
  const [rows, setRows] = useState<Row[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const processing = useRef<Promise<void>>(Promise.resolve());
  const busy = rows.some((r) => r.status === "waiting" || r.status === "uploading" || r.status === "processing");

  const sessionBookings = bookings.filter((b) => b.date === date && (!b.slot || b.slot === slot));
  const otherBookings = bookings.filter((b) => !sessionBookings.includes(b));
  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  async function sendOriginal(file: File, onProgress: (n: number) => void): Promise<{ pathname: string }> {
    const ext = (file.name.match(/\.(mp4|mov|m4v|webm)$/i)?.[1] ?? "mp4").toLowerCase();
    const safe = `${file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "clip"}.${ext}`;
    if (driver === "vercel") {
      const blob = await upload(`clips/${safe}`, file, {
        access: "private",
        handleUploadUrl: "/api/admin/clips/upload",
        contentType: file.type || "video/mp4",
        multipart: file.size > 20 * 1024 * 1024,
        onUploadProgress: (p) => onProgress(Math.round(p.percentage)),
      });
      return { pathname: blob.pathname };
    }
    // Local development/test storage.
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", `/api/admin/clips/upload?name=${encodeURIComponent(safe)}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => (xhr.status < 300 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(`Error ${xhr.status}`)));
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(file);
    });
  }

  function queuePreview(key: string, clipId: string) {
    processing.current = processing.current.then(async () => {
      const res = await fetch("/api/admin/clips/process", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: clipId }) }).catch(() => null);
      const json = (await res?.json().catch(() => ({}))) as { ok?: boolean; error?: string } | undefined;
      patch(key, json?.ok ? { status: "ready" } : { status: "failed", error: json?.error ?? "Preview failed — retry from the clip page." });
    });
  }

  async function addFiles(files: File[]) {
    if (!files.length) return;
    const batch = files.map((f, i) => ({ file: f, key: `${Date.now()}-${i}` }));
    setRows((rs) => [...rs, ...batch.map(({ file, key }) => ({ key, name: file.name, status: "waiting" as const, progress: 0, description: "", bookingId: batchBooking }))]);
    for (const { file, key } of batch) {
      const problem = checkVideoFile(file);
      if (problem) {
        patch(key, { status: "failed", error: problem });
        continue;
      }
      try {
        patch(key, { status: "uploading" });
        const { pathname } = await sendOriginal(file, (progress) => patch(key, { progress }));
        const made = await createClip({ key: pathname, name: file.name, size: file.size, date, slot, locationId: spotId || null, description: "", bookingId: batchBooking || null });
        if ("error" in made) throw new Error(made.error);
        patch(key, { status: "processing", clipId: made.id, code: made.code });
        queuePreview(key, made.id);
      } catch (e) {
        patch(key, { status: "failed", error: `Upload failed: ${(e as Error).message}` });
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  const field = "mt-1 block w-full rounded-lg border border-slate/30 bg-white px-3 py-2.5 text-sm";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border border-slate/15 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} className={field} />
        </label>
        <label className="text-sm font-medium">
          Session
          <select value={slot} onChange={(e) => setSlot(e.target.value as Slot)} disabled={busy} className={field}>
            {SLOTS.map((s) => (
              <option key={s} value={s}>
                {SLOT_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Surf spot
          <select value={spotId} onChange={(e) => setSpotId(e.target.value)} disabled={busy} className={field}>
            {spots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
            {spots.length === 0 && <option value="">No spot (add a clip code under Locations)</option>}
          </select>
        </label>
        <label className="text-sm font-medium">
          These clips are for
          <select value={batchBooking} onChange={(e) => setBatchBooking(e.target.value)} className={field}>
            <option value="">Public gallery (anyone can buy)</option>
            {sessionBookings.length > 0 && (
              <optgroup label="Booked this session">
                {sessionBookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </optgroup>
            )}
            {otherBookings.length > 0 && (
              <optgroup label="Other bookings">
                {otherBookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg bg-abyss px-6 py-3.5 text-sm font-semibold text-white hover:bg-ink-3">
          {rows.length ? "+ Add more clips" : "Choose clips"}
        </button>
        <p className="text-xs text-slate">Pick many at once. Originals stay private; guests only see a short watermarked preview.</p>
      </div>
      <input ref={fileRef} type="file" accept="video/*" multiple aria-label="Choose clips" className="hidden" onChange={(e) => addFiles(Array.from(e.target.files ?? []))} />

      {rows.length > 0 && (
        <ul className="divide-y divide-slate/10 rounded-xl border border-slate/15 bg-white">
          {rows.map((r) => (
            <li key={r.key} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-3 text-sm">
                  <span className="font-mono font-semibold">{r.code ?? "—"}</span>
                  <span className="truncate text-slate">{r.name}</span>
                </p>
                <p className={r.status === "failed" ? "mt-1 text-xs text-red-700" : r.status === "ready" ? "mt-1 text-xs text-emerald-700" : "mt-1 text-xs text-slate"}>
                  {r.status === "waiting" && "Waiting"}
                  {r.status === "uploading" && `Uploading original… ${r.progress}%`}
                  {r.status === "processing" && "Making preview…"}
                  {r.status === "ready" && "✓ Ready"}
                  {r.status === "failed" && r.error}
                </p>
                {r.status === "uploading" && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foam">
                    <div className="h-full bg-gold-deep transition-[width]" style={{ width: `${r.progress}%` }} />
                  </div>
                )}
              </div>
              {r.clipId && (
                <div className="grid gap-2 sm:w-[28rem] sm:grid-cols-2">
                  <input
                    aria-label={`Surfer description for ${r.code}`}
                    placeholder="Surfer: e.g. red board, black rashie"
                    defaultValue={r.description}
                    maxLength={200}
                    onBlur={(e) => {
                      const description = e.target.value.trim();
                      if (description !== r.description) void updateClip(r.clipId!, { description }).then(() => patch(r.key, { description }));
                    }}
                    className="rounded-lg border border-slate/30 px-3 py-2 text-sm"
                  />
                  <select
                    aria-label={`Booking for ${r.code}`}
                    value={r.bookingId}
                    onChange={(e) => {
                      const bookingId = e.target.value;
                      patch(r.key, { bookingId });
                      void updateClip(r.clipId!, { bookingId: bookingId || null });
                    }}
                    className="rounded-lg border border-slate/30 px-2 py-2 text-sm"
                  >
                    <option value="">Public gallery</option>
                    {bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {busy && <p className="text-sm font-medium">Keep this page open until every clip says Ready.</p>}
    </div>
  );
}
