"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/client-api";
import { Brand } from "./GalleryStates";

export function GalleryLogin({ token, title }: { token: string; title: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="w-full max-w-sm animate-rise">
        <Brand />
        <p className="mt-14 text-center text-xs uppercase tracking-[0.3em] text-mist-400">Your private gallery</p>
        <h1 className="mt-3 text-center text-2xl font-semibold tracking-tight">{title}</h1>
        <form
          className="mt-10 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            setError(null);
            try {
              await api("/api/client/login", { body: { token, password } });
              router.refresh();
            } catch (err) {
              if (err instanceof ApiError && err.status === 410) router.refresh();
              setError(err instanceof ApiError ? err.message : "Could not sign in");
            } finally {
              setLoading(false);
            }
          }}
        >
          <label htmlFor="gpw" className="sr-only">
            Gallery password
          </label>
          <input
            id="gpw"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 w-full rounded-xl border border-ink-600 bg-ink-850 px-4 text-center text-base tracking-wider placeholder:text-mist-400 focus:border-ocean-400 focus:outline-none"
          />
          {error && (
            <p role="alert" className="text-center text-sm text-coral-400">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-mist-100 text-sm font-semibold tracking-wider text-ink-950 transition-colors hover:bg-white disabled:opacity-60">
            {loading ? "Opening…" : "OPEN GALLERY"}
          </button>
        </form>
      </div>
    </main>
  );
}
