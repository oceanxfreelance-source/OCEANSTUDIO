import { NextResponse, type NextRequest } from "next/server";

/**
 * - Per-request CSP nonce (Next.js applies it to its own inline scripts).
 * - Cheap cookie-presence gate for /admin pages (real verification happens
 *   server-side against the database in the admin layout and every API).
 * - noindex for everything: this is a private application.
 */
export function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const storageOrigins = [process.env.STORAGE_PUBLIC_ENDPOINT, process.env.STORAGE_ENDPOINT]
    .filter(Boolean)
    .map((u) => {
      try {
        return new URL(u!).origin;
      } catch {
        return "";
      }
    })
    .join(" ");
  // Signed storage URLs may be virtual-hosted (bucket.host), so https: is allowed for media and uploads.
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https: ${storageOrigins}`,
    `media-src 'self' blob: https: ${storageOrigins}`,
    `connect-src 'self' https: ${storageOrigins}${dev ? " ws: http://localhost:* http://127.0.0.1:*" : ""}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const { pathname } = req.nextUrl;
  const adminCookie = req.cookies.get("__Host-ox_admin") ?? req.cookies.get("ox_admin");
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login") && !adminCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", dev ? csp.replace("upgrade-insecure-requests", "") : csp);
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return res;
}

export const config = {
  matcher: [{ source: "/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)" }],
};
