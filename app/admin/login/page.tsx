import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { getAdminFromCookies } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "Admin sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAdminFromCookies()) redirect("/admin");
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm animate-rise">
        <div className="mb-10 text-center">
          <p className="text-sm font-bold tracking-[0.4em] text-mist-100">
            OCEANX <span className="font-light text-mist-400">STUDIO</span>
          </p>
          <p className="mt-3 text-xs text-mist-400">Administrator access</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
