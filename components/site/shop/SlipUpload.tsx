"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/** Shrink a phone photo before upload (island internet + 4 MB limit). PDFs go as they are. */
async function shrink(file: File): Promise<Blob> {
  if (file.type === "application/pdf" || !file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
  } catch {
    return file; // e.g. a format this browser can't draw — the server will check it
  }
}

export function SlipUpload({ token, count }: { token: string; count: number }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send(file: File) {
    setError(null);
    setState("sending");
    const fd = new FormData();
    fd.set("token", token);
    const body = await shrink(file);
    fd.set("file", body, file.type === "application/pdf" ? "slip.pdf" : "slip.jpg");
    const res = await fetch("/api/slip", { method: "POST", body: fd }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) as { ok?: boolean; error?: string } | undefined;
    if (j?.ok) {
      setState("done");
      router.refresh();
    } else {
      setState("idle");
      setError(j?.error ?? "Upload failed. Please try again.");
    }
    if (ref.current) ref.current.value = "";
  }

  return (
    <div>
      <button type="button" disabled={state === "sending"} onClick={() => ref.current?.click()} className="w-full rounded-full border border-gold/70 py-3.5 text-[12px] font-semibold tracking-[0.16em] text-gold disabled:opacity-60">
        {state === "sending" ? "UPLOADING…" : count > 0 || state === "done" ? "UPLOAD ANOTHER SLIP" : "UPLOAD PAYMENT SLIP"}
      </button>
      <input ref={ref} type="file" accept="image/*,application/pdf" aria-label="Payment slip" className="hidden" onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
      {(count > 0 || state === "done") && <p className="mt-2 text-center text-xs text-emerald-300">✓ Slip received ({Math.max(count, 1)}) — we&apos;ll confirm your payment soon.</p>}
      {error && <p className="mt-2 text-center text-xs text-red-300">{error}</p>}
    </div>
  );
}
