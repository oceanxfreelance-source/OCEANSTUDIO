import { NextResponse, type NextRequest } from "next/server";

/**
 * First line of defence for /superadmin: no session cookie → login page.
 * The REAL check (is the session valid in the database?) happens in
 * requireAdmin() inside every admin page and action, so a fake cookie gets
 * nothing. Admin pages are also marked noindex.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLogin = pathname === "/superadmin/login";
  if (!isLogin && !req.cookies.has("ox_admin")) {
    const url = req.nextUrl.clone();
    url.pathname = "/superadmin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = { matcher: ["/superadmin", "/superadmin/:path*", "/api/admin/:path*"] };
