"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Dashboard button: optimise every older video for phones, one after another. */
export function OptimiseAll({ urls }: { urls: string[] }) {
  const router = useRouter();
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function start() {
    setRunning(true);
    setErrors([]);
    for (const url of urls) {
      const res = await fetch("/api/admin/video-optimize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) }).catch(() => null);
      if (!res?.ok) {
        const j = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
        setErrors((e) => [...e, j?.error ?? "One video couldn't be optimised."]);
      }
      setDone((d) => d + 1);
    }
    setRunning(false);
    router.refresh();
  }

  return (
    <div className="mt-3">
      <button type="button" disabled={running} onClick={start} className="rounded-lg bg-abyss px-4 py-2 text-sm font-semibold text-white hover:bg-ink-3 disabled:opacity-70">
        {running ? `Optimising ${Math.min(done + 1, urls.length)} of ${urls.length}… keep this page open` : `Optimise ${urls.length === 1 ? "it" : `all ${urls.length}`} now`}
      </button>
      {errors.map((e, i) => (
        <p key={i} className="mt-2 text-xs text-red-700">
          {e}
        </p>
      ))}
    </div>
  );
}
