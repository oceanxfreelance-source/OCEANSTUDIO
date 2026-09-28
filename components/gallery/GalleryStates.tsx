"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function Brand() {
  return (
    <p className="text-center text-[12px] font-bold tracking-[0.42em] text-mist-100">
      OCEANX <span className="font-light text-mist-400">STUDIO</span>
    </p>
  );
}

export function GalleryExpired() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="max-w-sm animate-rise text-center">
        <Brand />
        <h1 className="mt-14 text-xl font-semibold tracking-[0.2em]">GALLERY EXPIRED</h1>
        <p className="mt-4 text-sm leading-relaxed text-mist-300">This private gallery was available for 48 hours and is no longer accessible.</p>
        <p className="mt-3 text-sm leading-relaxed text-mist-400">Please contact the photographer if you need a new access link.</p>
      </div>
    </main>
  );
}

export function GalleryMessage({ title, body, refresh }: { title: string; body: string; refresh?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!refresh) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [refresh, router]);
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="max-w-sm animate-rise text-center">
        <Brand />
        <h1 className="mt-14 text-lg font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-mist-400">{body}</p>
        {refresh && <span className="mx-auto mt-6 block size-5 animate-spin rounded-full border-2 border-ocean-400 border-t-transparent" aria-hidden />}
      </div>
    </main>
  );
}
