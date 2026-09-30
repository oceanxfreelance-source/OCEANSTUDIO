import type { Metadata, Viewport } from "next";
import { Inter, Archivo } from "next/font/google";
import { getContent } from "@/lib/content";
import { BRAND, siteUrl } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Archivo's width axis gives the display type its wide, cinematic feel.
const display = Archivo({ subsets: ["latin"], variable: "--font-display", display: "swap", axes: ["wdth"] });

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s — ${BRAND.name}` },
    description: c["seo.description"],
    applicationName: BRAND.name,
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      locale: "en_US",
      title: `${BRAND.name} — ${BRAND.tagline}`,
      description: c["seo.description"],
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: BRAND.name }],
    },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  themeColor: "#04080b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <head>
        {/* Marks JS as available so scroll-reveal animations can hide content until it scrolls in. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
