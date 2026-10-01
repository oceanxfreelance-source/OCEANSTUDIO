import Link from "next/link";
import { cx } from "@/components/ui/cx";
import { FieldError } from "./ActionForm";

// ── Layout pieces ──────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: string; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-8">
      {back && (
        <Link href={back.href} className="mb-3 inline-block text-sm text-slate hover:text-deep">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ title, children, className, actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cx("rounded-xl border border-slate/15 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-6", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          {title && <h2 className="text-sm font-semibold uppercase tracking-wider text-slate">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, href, tone = "default" }: { label: string; value: React.ReactNode; href?: string; tone?: "default" | "accent" }) {
  const body = (
    <div className={cx("h-full rounded-xl border p-5 transition-colors", tone === "accent" ? "border-gold-deep/30 bg-gold/10" : "border-slate/15 bg-white", href && "hover:border-slate/40")}>
      <p className="text-xs font-medium uppercase tracking-wider text-slate">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

const BADGE: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  purple: "bg-violet-50 text-violet-800 ring-violet-200",
};
export type BadgeTone = keyof typeof BADGE;

export function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: BadgeTone }) {
  return <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", BADGE[tone])}>{children}</span>;
}

export const STATUS_TONE: Record<string, BadgeTone> = {
  NEW: "blue",
  CONTACTED: "amber",
  CONFIRMED: "purple",
  COMPLETED: "green",
  CANCELLED: "gray",
  ACTIVE: "green",
  COMING_SOON: "amber",
  HIDDEN: "gray",
  UNPAID: "red",
  DEPOSIT: "amber",
  PAID: "green",
  REFUNDED: "gray",
  SCHEDULED: "blue",
  NOT_READY: "gray",
  PROCESSING: "amber",
  READY: "blue",
  SENT: "green",
};

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
        variant === "primary" ? "bg-abyss text-white hover:bg-ink-3" : "border border-slate/30 bg-white text-deep hover:bg-foam",
      )}
    >
      {children}
    </Link>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate/30 bg-white px-6 py-12 text-center text-sm text-slate">{children}</div>;
}

// ── Tables ─────────────────────────────────────────────────────────────
export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate/15 bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-slate/15 bg-foam/60 text-xs uppercase tracking-wider text-slate">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate/10">{children}</tbody>
      </table>
    </div>
  );
}

// ── Form fields (work with ActionForm) ─────────────────────────────────
const control = "mt-1.5 block w-full rounded-lg border border-slate/30 bg-white px-3 py-2.5 text-sm text-deep shadow-sm placeholder:text-slate/50 focus:border-gold-deep focus:outline-none focus:ring-2 focus:ring-gold/30";

type Base = { label: string; name: string; hint?: string; className?: string; required?: boolean };

function Label({ label, name, required }: { label: string; name: string; required?: boolean }) {
  return (
    <label htmlFor={name} className="block text-sm font-medium text-deep">
      {label}
      {required && <span className="text-red-600"> *</span>}
    </label>
  );
}

export function TextField({ label, name, hint, className, required, ...rest }: Base & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <Label label={label} name={name} required={required} />
      <input id={name} name={name} required={required} className={control} {...rest} />
      {hint && <p className="mt-1.5 text-xs text-slate">{hint}</p>}
      <FieldError name={name} />
    </div>
  );
}

export function TextArea({ label, name, hint, className, required, rows = 5, ...rest }: Base & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={className}>
      <Label label={label} name={name} required={required} />
      <textarea id={name} name={name} rows={rows} required={required} className={cx(control, "resize-y leading-relaxed")} {...rest} />
      {hint && <p className="mt-1.5 text-xs text-slate">{hint}</p>}
      <FieldError name={name} />
    </div>
  );
}

export function Select({
  label,
  name,
  hint,
  className,
  required,
  options,
  ...rest
}: Base & React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <div className={className}>
      <Label label={label} name={name} required={required} />
      <select id={name} name={name} required={required} className={control} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1.5 text-xs text-slate">{hint}</p>}
      <FieldError name={name} />
    </div>
  );
}

export function Checkbox({ label, name, defaultChecked, hint }: { label: string; name: string; defaultChecked?: boolean; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate/20 bg-white px-3 py-2.5">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 rounded border-slate/40 accent-[#0b1a22]" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-slate">{hint}</span>}
      </span>
    </label>
  );
}

export function options<T extends Record<string, string>>(labels: T): { value: keyof T & string; label: string }[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}
