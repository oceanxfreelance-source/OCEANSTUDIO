import type { Metadata } from "next";

// The admin area is never indexed by search engines.
export const metadata: Metadata = {
  title: { default: "Superadmin", template: "%s · Ocean X Superadmin" },
  robots: { index: false, follow: false, nocache: true },
};

export default function SuperadminRoot({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-[#f4f5f3] text-deep">{children}</div>;
}
