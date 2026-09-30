/** Public base URL, used for canonical links, sitemap and Open Graph. */
export function siteUrl(): string {
  const raw =
    process.env.SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export const BRAND = {
  name: "OCEAN X",
  tagline: "Surf Films & Photography at Machines, Maabaidhoo",
  region: "Laamu Atoll",
  country: "Maldives",
} as const;
