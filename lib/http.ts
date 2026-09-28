import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType, type ZodTypeDef } from "zod";
import { AppError, badRequest, forbidden } from "./errors";
import { env } from "./env";
import { logger } from "./logger";

export function clientIp(req: Request): string {
  if (env().TRUST_PROXY === "true") {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
    const real = req.headers.get("x-real-ip");
    if (real) return real.trim();
  }
  return "unknown";
}

/** JSON serialiser that renders BigInt (file sizes) as numbers. */
export function toJson(data: unknown): string {
  return JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v));
}

export function json(data: unknown, init: number | ResponseInit = 200): NextResponse {
  const responseInit = typeof init === "number" ? { status: init } : init;
  return new NextResponse(toJson(data), {
    ...responseInit,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...responseInit.headers },
  });
}

/**
 * CSRF defence for cookie-authenticated mutations: the Origin (or Referer) of a
 * state-changing request must be our own origin. Cookies are also SameSite=Lax.
 */
export function assertSameOrigin(req: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin") ?? (req.headers.get("referer") ? new URL(req.headers.get("referer")!).origin : null);
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") throw forbidden("Cross-site request rejected");
  if (!origin) return; // non-browser client: cannot carry a victim's cookies cross-site
  const allowed = new Set<string>([new URL(env().APP_URL).origin]);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
    allowed.add(`${proto}://${host}`);
  }
  if (!allowed.has(origin)) throw forbidden("Cross-origin request rejected");
}

export async function parseJson<T>(req: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > 1_000_000) throw badRequest("Request body too large");
    body = text ? JSON.parse(text) : {};
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw badRequest("Invalid JSON body");
  }
  return schema.parse(body);
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T, ZodTypeDef, unknown>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    const headers: Record<string, string> = {};
    const retry = (err.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
    if (err.status === 429 && retry) headers["retry-after"] = String(retry);
    return json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status, headers });
  }
  if (err instanceof ZodError) {
    return json(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: err.issues[0]?.message ?? "Invalid request",
          details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      400,
    );
  }
  logger.error({ err }, "unhandled API error");
  return json({ error: { code: "INTERNAL", message: "Something went wrong. The error has been logged." } }, 500);
}

type RouteContext<P> = { params: Promise<P> };

/** Wrap a route handler with uniform error handling. */
export function route<P = Record<string, never>>(
  fn: (req: NextRequest, params: P) => Promise<Response>,
): (req: NextRequest, ctx: RouteContext<P>) => Promise<Response> {
  return async (req, ctx) => {
    try {
      const params = ctx?.params ? await ctx.params : ({} as P);
      return await fn(req, params);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
