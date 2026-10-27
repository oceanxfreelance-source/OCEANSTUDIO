import "server-only";
import http from "node:http";
import type { AddressInfo } from "node:net";

/**
 * The static ffmpeg build crashes when it resolves hostnames itself, so it
 * reads remote files through this tiny relay on 127.0.0.1, which forwards
 * byte-range requests to the (signed) URL. ffmpeg then fetches only the parts
 * it needs — a 500 MB original never has to fit on the server's disk.
 */
export async function withRangeRelay<T>(target: string, fn: (localUrl: string) => Promise<T>): Promise<T> {
  const server = http.createServer(async (req, res) => {
    try {
      const headers: Record<string, string> = {};
      if (req.headers.range) headers.range = req.headers.range;
      const up = await fetch(target, { method: req.method === "HEAD" ? "HEAD" : "GET", headers });
      const out: Record<string, string> = {};
      for (const k of ["content-type", "content-length", "content-range", "accept-ranges"]) {
        const v = up.headers.get(k);
        if (v) out[k] = v;
      }
      res.writeHead(up.status, out);
      if (req.method === "HEAD" || !up.body) return res.end();
      const reader = up.body.getReader();
      req.on("close", () => void reader.cancel().catch(() => undefined));
      for (;;) {
        const { done, value } = await reader.read().catch(() => ({ done: true as const, value: undefined }));
        if (done || res.destroyed) break;
        if (!res.write(value)) await new Promise((r) => res.once("drain", r));
      }
      res.end();
    } catch {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    return await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}/file`);
  } finally {
    server.closeAllConnections();
    server.close();
  }
}
