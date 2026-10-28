"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "../actions";

const control = "mt-1.5 block w-full rounded-lg border border-white/15 bg-white/5 px-3.5 py-3 text-sm text-foam placeholder:text-foam/30 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, undefined);
  return (
    <form action={action} className="space-y-5">
      {state?.error && (
        <p role="alert" className="rounded-lg border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-foam">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="email" className="text-sm text-foam/80">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className={control} />
      </div>
      <div>
        <label htmlFor="password" className="text-sm text-foam/80">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={control} />
      </div>
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-foam py-3 text-sm font-semibold text-abyss hover:bg-white disabled:opacity-60">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
