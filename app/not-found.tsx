import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center bg-abyss px-6 text-center text-foam">
      <p className="eyebrow text-sea">404</p>
      <h1 className="display mt-4 text-5xl [font-stretch:115%]">Lost at sea.</h1>
      <p className="mt-4 text-mist">This page doesn&apos;t exist or has moved.</p>
      <Link href="/" className="mt-10 rounded-full bg-foam px-7 py-4 text-[12px] font-semibold tracking-[0.16em] text-abyss">
        BACK TO SHORE
      </Link>
    </main>
  );
}
