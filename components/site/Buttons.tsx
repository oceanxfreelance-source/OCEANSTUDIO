import Link from "next/link";
import { cx } from "@/components/ui/cx";
import { ArrowRight } from "./Icons";

type Variant = "light" | "dark" | "outline-light" | "outline-dark";

const styles: Record<Variant, string> = {
  light: "bg-foam text-abyss hover:bg-white",
  dark: "bg-abyss text-foam hover:bg-ink-2",
  "outline-light": "border border-foam/40 text-foam hover:border-foam hover:bg-foam/5",
  "outline-dark": "border border-deep/25 text-deep hover:border-deep",
};

export function ButtonLink({ href, children, variant = "light", arrow = false, className }: { href: string; children: React.ReactNode; variant?: Variant; arrow?: boolean; className?: string }) {
  return (
    <Link
      href={href}
      className={cx(
        "btn-lift group inline-flex items-center justify-center gap-3 rounded-full px-7 py-4 text-[12px] font-semibold tracking-[0.16em]",
        styles[variant],
        className,
      )}
    >
      {children}
      {arrow && <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />}
    </Link>
  );
}
