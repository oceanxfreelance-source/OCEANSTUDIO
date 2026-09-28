import { env } from "../env";

export const isSecureCookies = () => env().APP_URL.startsWith("https://");

/** "__Host-" prefix (secure, host-only, path=/) whenever we are served over HTTPS. */
export function cookieName(base: string): string {
  return isSecureCookies() ? `__Host-${base}` : base;
}

export function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: isSecureCookies(),
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}
