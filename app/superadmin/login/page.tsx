import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAdmin()) redirect("/superadmin");
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-abyss px-5 text-foam">
      <div className="w-full max-w-sm">
        <p className="display text-center text-xl tracking-[0.18em] [font-stretch:125%]">
          OCEAN<span className="ml-[0.35em] text-gold">X</span>
        </p>
        <p className="mt-2 text-center text-xs uppercase tracking-[0.28em] text-foam/50">Superadmin</p>
        <div className="mt-10 rounded-2xl border border-white/10 bg-ink/80 p-7">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-foam/40">Private area. Access is logged and rate-limited.</p>
      </div>
    </main>
  );
}
