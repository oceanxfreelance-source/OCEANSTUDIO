import { cx } from "@/components/ui/cx";
import { Instagram } from "./Icons";

/**
 * "Book via Instagram" — opens a direct message to Ocean X on Instagram.
 * Renders nothing until the admin has added the Instagram username
 * (Superadmin → Website content → Contact & social).
 */
export function InstagramBookButton({
  dmUrl,
  variant = "gold",
  label = "BOOK VIA INSTAGRAM",
  className,
}: {
  dmUrl: string | null;
  variant?: "gold" | "light" | "dark" | "outline-light" | "outline-dark";
  label?: string;
  className?: string;
}) {
  if (!dmUrl) return null;
  const styles = {
    gold: "bg-gold text-abyss hover:bg-[#d8bc86]",
    light: "bg-foam text-abyss hover:bg-white",
    dark: "bg-abyss text-foam hover:bg-ink-2",
    "outline-light": "border border-foam/40 text-foam hover:border-foam",
    "outline-dark": "border border-deep/25 text-deep hover:border-deep",
  }[variant];
  return (
    <a
      href={dmUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cx(
        "btn-lift inline-flex items-center justify-center gap-3 rounded-full px-7 py-4 text-[12px] font-semibold tracking-[0.16em]",
        styles,
        className,
      )}
    >
      <Instagram className="h-4 w-4" /> {label}
    </a>
  );
}
