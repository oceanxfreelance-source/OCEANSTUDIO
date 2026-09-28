import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "OCEANX STUDIO", template: "%s · OCEANX STUDIO" },
  description: "Private professional photo & video delivery.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
  referrer: "no-referrer",
};

export const viewport: Viewport = { themeColor: "#0b0e11", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
