"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useTransition } from "react";
import type { FormState } from "@/lib/forms";
import { cx } from "@/components/ui/cx";

/**
 * Wrapper for admin forms that call a server action.
 * - Shows the action's error / success message
 * - Makes field errors available to <FieldError name="…" />
 * - Keeps what the admin typed if validation fails (no auto-reset)
 */
const ErrorsCtx = createContext<{ errors: Record<string, string>; pending: boolean }>({ errors: {}, pending: false });

export function ActionForm({
  action,
  children,
  className,
  successMessage = "Saved.",
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  successMessage?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [pending, startTransition] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state?.error) topRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state]);

  return (
    <ErrorsCtx.Provider value={{ errors: state?.fieldErrors ?? {}, pending }}>
      <form
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => formAction(fd));
        }}
      >
        <div ref={topRef}>
          {state?.error && (
            <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {state.error}
            </p>
          )}
          {state?.ok && !pending && (
            <p role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {state.message ?? successMessage}
            </p>
          )}
        </div>
        {children}
      </form>
    </ErrorsCtx.Provider>
  );
}

export function FieldError({ name }: { name: string }) {
  const { errors } = useContext(ErrorsCtx);
  return errors[name] ? <p className="mt-1.5 text-xs text-red-700">{errors[name]}</p> : null;
}

export function SubmitButton({ children = "Save", className, variant = "primary" }: { children?: React.ReactNode; className?: string; variant?: "primary" | "secondary" }) {
  const { pending } = useContext(ErrorsCtx);
  return (
    <button
      type="submit"
      disabled={pending}
      className={cx(
        "inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60",
        variant === "primary" ? "bg-abyss text-white hover:bg-ink-3" : "border border-slate/30 bg-white text-deep hover:bg-foam",
        className,
      )}
    >
      {pending ? "Saving…" : children}
    </button>
  );
}
