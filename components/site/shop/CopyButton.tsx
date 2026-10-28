"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const t = document.createElement("textarea");
          t.value = text;
          document.body.appendChild(t);
          t.select();
          document.execCommand("copy");
          t.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
      className={className ?? "rounded-full border border-current px-4 py-1.5 text-[11px] font-semibold tracking-[0.14em]"}
    >
      {done ? "✓ COPIED" : label.toUpperCase()}
    </button>
  );
}
