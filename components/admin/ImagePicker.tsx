"use client";

import { useRef, useState } from "react";

/**
 * Image field for admin forms. Uploads each chosen photo straight away and
 * stores the resulting ids in a hidden input (`name`), comma-separated.
 *
 * Photos are resized in the browser first (max 2600px JPEG) so even big phone
 * or camera files upload quickly and stay under hosting limits.
 */
type Item = { id: string };

async function shrink(file: File): Promise<Blob> {
  if (file.size < 1_500_000 && /jpe?g|webp/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    return blob ?? file;
  } catch {
    return file; // browser can't decode it (e.g. HEIC on Chrome) — let the server try
  }
}

export function ImagePicker({ name, initial = [], multiple = false, label, hint }: { name: string; initial?: Item[]; multiple?: boolean; label: string; hint?: string }) {
  const [items, setItems] = useState<Item[]>(initial);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList) {
    setError(null);
    const list = [...files].slice(0, multiple ? 20 : 1);
    setBusy((b) => b + list.length);
    for (const f of list) {
      try {
        const body = new FormData();
        body.append("file", await shrink(f), f.name.replace(/\.\w+$/, ".jpg"));
        const res = await fetch("/api/admin/media", { method: "POST", body });
        const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
        if (!res.ok || !json.id) throw new Error(json.error ?? `Upload failed (${res.status})`);
        setItems((xs) => (multiple ? [...xs, { id: json.id! }] : [{ id: json.id! }]));
      } catch (e) {
        setError(`${f.name}: ${(e as Error).message}`);
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  const move = (i: number, d: -1 | 1) =>
    setItems((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const copy = [...xs];
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      return copy;
    });

  return (
    <div>
      <p className="block text-sm font-medium text-deep">{label}</p>
      <input type="hidden" name={name} value={items.map((i) => i.id).join(",")} />
      <div className="mt-1.5 flex flex-wrap gap-3">
        {items.map((it, i) => (
          <div key={it.id} className="group relative h-28 w-28 overflow-hidden rounded-lg border border-slate/20 bg-foam">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/media/${it.id}?size=thumb`} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 px-1 py-0.5 text-xs text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
              {multiple ? (
                <span className="flex gap-1">
                  <button type="button" onClick={() => move(i, -1)} aria-label="Move left" className="px-1">←</button>
                  <button type="button" onClick={() => move(i, 1)} aria-label="Move right" className="px-1">→</button>
                </span>
              ) : (
                <span />
              )}
              <button type="button" onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))} className="px-1" aria-label="Remove image">
                ✕
              </button>
            </div>
          </div>
        ))}
        {(multiple || items.length === 0) && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-28 w-28 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate/30 text-xs text-slate hover:border-sea-deep hover:text-deep"
          >
            <span className="text-2xl leading-none">+</span>
            {busy > 0 ? "Uploading…" : multiple ? "Add photos" : "Add photo"}
          </button>
        )}
        {!multiple && items.length > 0 && (
          <button type="button" onClick={() => inputRef.current?.click()} className="self-end text-xs text-slate underline hover:text-deep">
            Replace
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple={multiple} className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
      {busy > 0 && <p className="mt-2 text-xs text-slate">Uploading {busy} image{busy > 1 ? "s" : ""}… keep this page open.</p>}
      {hint && <p className="mt-1.5 text-xs text-slate">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  );
}
