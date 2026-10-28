"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { addDeliveryFile } from "@/lib/admin-shop";

/** Upload a finished file for the buyer (e.g. the edited reel). Private, delivered through the order page. */
export function DeliveryFileUpload({ orderId, bookingId, driver }: { orderId?: string; bookingId?: string; driver: "vercel" | "local" }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(file: File) {
    setError(null);
    setProgress(0);
    try {
      const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60) || "file.mp4";
      let key: string;
      if (driver === "vercel") {
        const b = await upload(`files/${safe}`, file, {
          access: "private",
          handleUploadUrl: "/api/admin/clips/upload",
          multipart: file.size > 20 * 1024 * 1024,
          onUploadProgress: (p) => setProgress(Math.round(p.percentage)),
        });
        key = b.pathname;
      } else {
        const res = await fetch(`/api/admin/clips/upload?folder=files&name=${encodeURIComponent(safe)}`, { method: "PUT", body: file });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        key = ((await res.json()) as { pathname: string }).pathname;
      }
      await addDeliveryFile({ orderId, bookingId }, { key, name: file.name.slice(0, 120), size: file.size });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div>
      <button type="button" disabled={progress !== null} onClick={() => ref.current?.click()} className="rounded-lg border border-slate/30 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-foam disabled:opacity-60">
        {progress !== null ? `Uploading… ${progress}%` : "+ Upload reel / file"}
      </button>
      <input ref={ref} type="file" aria-label="Delivery file" className="hidden" onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
