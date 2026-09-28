"use client";

import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** Full width unless the caller sets an explicit width (avoids conflicting utility classes). */
function widthOr(className?: string) {
  return /(^|\s)(max-)?w-/.test(className ?? "") ? className : cx("w-full", className);
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-ocean-400 text-ink-950 hover:bg-ocean-300 disabled:bg-ink-600 disabled:text-mist-400",
  secondary: "bg-ink-750 text-mist-100 border border-ink-600 hover:border-ink-500 hover:bg-ink-700 disabled:opacity-50",
  ghost: "text-mist-200 hover:bg-ink-750 disabled:opacity-40",
  danger: "bg-coral-400/10 text-coral-400 border border-coral-400/30 hover:bg-coral-400/20 disabled:opacity-50",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean }>(
  function Button({ variant = "secondary", size = "md", loading, className, children, disabled, ...rest }, ref) {
    const sizes = { sm: "h-8 px-3 text-xs", md: "h-9 px-4 text-sm", lg: "h-11 px-6 text-sm tracking-wide" };
    return (
      <button
        ref={ref}
        className={cx("inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed", variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
        {children}
      </button>
    );
  },
);

export function Card({ children, className, title, action, padded = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; padded?: boolean }) {
  return (
    <section className={cx("rounded-xl border border-ink-700 bg-ink-850", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-4 border-b border-ink-700 px-5 py-3.5">
          {typeof title === "string" ? <h2 className="eyebrow">{title}</h2> : title}
          {action}
        </header>
      )}
      <div className={padded ? "p-5" : undefined}>{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-mist-300">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-mist-400">{hint}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cx("h-9 rounded-lg border border-ink-600 bg-ink-900 px-3 text-sm text-mist-100 placeholder:text-mist-400 focus:border-ocean-500 focus:outline-none", widthOr(className))}
      {...rest}
    />
  );
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx("h-9 rounded-lg border border-ink-600 bg-ink-900 px-3 text-sm text-mist-100 focus:border-ocean-500 focus:outline-none", widthOr(className))} {...rest}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className={cx("flex items-start justify-between gap-4", disabled && "opacity-50")}>
      <div>
        <label htmlFor={id} className="text-sm text-mist-100">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-mist-400">{description}</p>}
      </div>
      <button
        id={id}
        role="switch"
        type="button"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx("relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-ocean-400" : "bg-ink-600")}
      >
        <span className={cx("absolute left-0 top-0.5 size-4 rounded-full bg-white transition-transform", checked ? "translate-x-4.5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, format, neutral = 0 }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string; neutral?: number }) {
  const id = useId();
  return (
    <div className="group">
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={id} className="text-xs text-mist-300" onDoubleClick={() => onChange(neutral)} title="Double-click to reset">
          {label}
        </label>
        <span className={cx("tabular text-xs", value === neutral ? "text-mist-400" : "text-ocean-300")}>{format ? format(value) : value > 0 && neutral === 0 ? `+${value}` : value}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1.5 w-full cursor-pointer" aria-valuetext={format ? format(value) : String(value)} />
    </div>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange, label }: { options: { value: T; label: string; disabled?: boolean }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-ink-600 bg-ink-900 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          type="button"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cx("rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40", value === o.value ? "bg-ink-700 text-mist-100 shadow" : "text-mist-400 hover:text-mist-200")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-kelp-400/10 text-kelp-400 border-kelp-400/25",
  READY: "bg-kelp-400/10 text-kelp-400 border-kelp-400/25",
  COMPLETED: "bg-kelp-400/10 text-kelp-400 border-kelp-400/25",
  OK: "bg-kelp-400/10 text-kelp-400 border-kelp-400/25",
  PROCESSING: "bg-ocean-400/10 text-ocean-300 border-ocean-400/25",
  PREPARING: "bg-ocean-400/10 text-ocean-300 border-ocean-400/25",
  INGESTING: "bg-ocean-400/10 text-ocean-300 border-ocean-400/25",
  UPLOADING: "bg-ocean-400/10 text-ocean-300 border-ocean-400/25",
  QUEUED: "bg-ink-700 text-mist-300 border-ink-600",
  DRAFT: "bg-ink-700 text-mist-300 border-ink-600",
  "EXPIRING SOON": "bg-sand-400/10 text-sand-400 border-sand-400/25",
  DELETING: "bg-sand-400/10 text-sand-400 border-sand-400/25",
  EXPIRED: "bg-ink-700 text-mist-400 border-ink-600",
  DELETED: "bg-ink-800 text-mist-400 border-ink-700",
  ARCHIVED: "bg-ink-800 text-mist-400 border-ink-700",
  CANCELLED: "bg-ink-800 text-mist-400 border-ink-700",
  REVOKED: "bg-coral-400/10 text-coral-400 border-coral-400/25",
  FAILED: "bg-coral-400/10 text-coral-400 border-coral-400/25",
  MISMATCH: "bg-coral-400/10 text-coral-400 border-coral-400/25",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={cx("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wider", STATUS_STYLES[status] ?? "bg-ink-700 text-mist-300 border-ink-600")}>{status}</span>;
}

export function QualityLabel({ label, ai }: { label: string; ai?: boolean }) {
  const original = label.startsWith("ORIGINAL");
  return (
    <span className={cx("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider", original ? "bg-mist-100 text-ink-950" : ai ? "bg-ocean-400/15 text-ocean-300" : "bg-ink-700 text-mist-200")}>
      {label}
    </span>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress"}>
        <div className="h-full rounded-full bg-ocean-400 transition-[width] duration-500" style={{ width: `${Math.max(2, value)}%` }} />
      </div>
      <span className="tabular w-9 text-right text-xs text-mist-300">{value}%</span>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-600 px-6 py-14 text-center">
      <p className="text-sm font-medium text-mist-200">{title}</p>
      {children && <div className="mt-2 max-w-md text-sm text-mist-400">{children}</div>}
    </div>
  );
}

export function Alert({ tone = "info", children, title }: { tone?: "info" | "warn" | "error" | "success"; children: ReactNode; title?: string }) {
  const tones = {
    info: "border-ocean-400/25 bg-ocean-400/5 text-mist-200",
    warn: "border-sand-400/30 bg-sand-400/5 text-sand-400",
    error: "border-coral-400/30 bg-coral-400/5 text-coral-400",
    success: "border-kelp-400/30 bg-kelp-400/5 text-kelp-400",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-lg border px-4 py-3 text-sm", tones[tone])}>
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export function CopyButton({ getValue, label, size = "sm" }: { getValue: () => Promise<string> | string; label: string; size?: "sm" | "md" }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  return (
    <Button
      size={size}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(await getValue());
          setState("copied");
        } catch {
          setState("error");
        }
        setTimeout(() => setState("idle"), 1800);
      }}
    >
      {state === "copied" ? "Copied" : state === "error" ? "Copy failed" : label}
    </Button>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx("m-auto w-full rounded-2xl border border-ink-600 bg-ink-850 p-0 text-mist-100 backdrop:bg-black/70 backdrop:backdrop-blur-sm", wide ? "max-w-4xl" : "max-w-lg")}
      aria-label={title}
    >
      {open && (
        <div className="animate-rise">
          <header className="flex items-center justify-between border-b border-ink-700 px-6 py-4">
            <h2 className="text-base font-semibold">{title}</h2>
            <button onClick={onClose} className="rounded-md p-1 text-mist-400 hover:text-mist-100" aria-label="Close">
              ✕
            </button>
          </header>
          <div className="max-h-[75vh] overflow-y-auto p-6">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "warn" | "error" }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850 px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p className={cx("tabular mt-2 text-2xl font-semibold tracking-tight", tone === "warn" ? "text-sand-400" : tone === "error" ? "text-coral-400" : "text-mist-100")}>{value}</p>
      {sub && <p className="mt-1 text-xs text-mist-400">{sub}</p>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-mist-100">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
