"use client";

import { useTransition } from "react";

/** A button that asks for confirmation, then runs a server action. Used for deletes. */
export function ConfirmButton({ action, confirm, children, className }: { action: () => Promise<unknown>; confirm: string; children: React.ReactNode; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm(confirm)) start(async () => void (await action()));
      }}
      className={className ?? "rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"}
    >
      {pending ? "Working…" : children}
    </button>
  );
}
