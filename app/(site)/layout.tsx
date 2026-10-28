import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { RevealObserver } from "@/components/site/Reveal";
import { ReviewBadge } from "@/components/site/ReviewBadge";
import { getReviewStats } from "@/lib/public";
import { CartProvider } from "@/components/site/shop/cart";
import { CartBar } from "@/components/site/shop/CartBar";
import { RefCapture } from "@/components/site/shop/RefCapture";
import { shopConfigFrom } from "@/lib/shop";
import { getContent } from "@/lib/content";
import { instagramUrl } from "@/lib/format";
import { BRAND, siteUrl } from "@/lib/site";

// Public pages read fresh content from the database; admin edits show up
// immediately (pages are also revalidated on every save).
export const revalidate = 300;

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [c, reviewStats] = await Promise.all([getContent(), getReviewStats()]);
  const ig = instagramUrl(c["social.instagram"]);
  const shop = shopConfigFrom(c);

  // Structured data so search engines understand who and where Ocean X is.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: BRAND.name,
    description: c["seo.description"],
    url: siteUrl(),
    areaServed: [{ "@type": "Place", name: "Machines surf break, Maabaidhoo, Laamu Atoll, Maldives" }],
    address: { "@type": "PostalAddress", addressLocality: "Maabaidhoo", addressRegion: "Laamu Atoll", addressCountry: "MV" },
    ...(c["contact.email"] ? { email: c["contact.email"] } : {}),
    ...(c["contact.whatsapp"] ? { telephone: c["contact.whatsapp"] } : {}),
    sameAs: [ig, c["social.youtube"], c["social.tiktok"], c["social.facebook"]].filter(Boolean),
  };

  return (
    <CartProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-foam focus:px-4 focus:py-2 focus:text-abyss">
        Skip to content
      </a>
      <Header instagramUrl={ig} />
      <main id="main">{children}</main>
      <Footer c={c} />
      <RevealObserver />
      <ReviewBadge average={reviewStats.average} count={reviewStats.count} />
      <CartBar prices={shop.prices} />
      <RefCapture />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </CartProvider>
  );
}
