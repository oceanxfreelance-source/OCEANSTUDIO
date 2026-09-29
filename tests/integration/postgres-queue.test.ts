/**
 * Redis-free mode: Postgres is the job queue (workers/poller.ts) and the
 * rate-limit store (lib/rate-limit.ts, used in production without Redis).
 */
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { consume, resetRateLimit } from "@/lib/rate-limit";
import { claimNextJob, drainQueue, recoverStaleJobs } from "@/workers/poller";
import { call, createAdmin, handlers, uploadFile } from "./helpers";

// Simulate a deployment with no REDIS_URL for this file.
const g = globalThis as unknown as { oceanxRedis?: unknown };
let savedRedis: unknown;
beforeAll(() => {
  savedRedis = g.oceanxRedis;
  g.oceanxRedis = null;
});
afterAll(() => {
  g.oceanxRedis = savedRedis;
});

describe("Postgres job queue (no Redis)", () => {
  it("claims queued jobs atomically, oldest first, exactly once", async () => {
    const a = await db.processingJob.create({ data: { jobType: "ZIP_PACKAGE", createdAt: new Date(Date.now() - 2000) } });
    const b = await db.processingJob.create({ data: { jobType: "ZIP_PACKAGE", createdAt: new Date(Date.now() - 1000) } });
    const [x, y, z] = await Promise.all([claimNextJob(), claimNextJob(), claimNextJob()]);
    const claimed = [x, y, z].filter(Boolean);
    expect(claimed.sort()).toEqual([a.id, b.id].sort());
    expect(await db.processingJob.count({ where: { id: { in: [a.id, b.id] }, status: "PROCESSING" } })).toBe(2);
    await db.processingJob.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  });

  it("an upload ingests end-to-end through the poller", async () => {
    const h = await handlers();
    const admin = await createAdmin();
    const p = await call(h.projects, "/api/admin/projects", { cookie: admin.cookie, body: { name: "Poller" } });
    const up = await uploadFile(admin.cookie, p.json.project.id, "poller.jpg", await sharp({ create: { width: 64, height: 48, channels: 3, background: "#2a6f97" } }).jpeg().toBuffer());
    expect(up.status).toBe(200);
    expect(await drainQueue()).toBeGreaterThan(0);
    const media = await db.mediaFile.findUniqueOrThrow({ where: { id: up.mediaId! } });
    expect(media.status).toBe("READY");
  });

  it("fails jobs left PROCESSING by a dead worker", async () => {
    const j = await db.processingJob.create({ data: { jobType: "ZIP_PACKAGE", status: "PROCESSING", startedAt: new Date(Date.now() - 3 * 3600_000) } });
    expect(await recoverStaleJobs(90)).toBeGreaterThanOrEqual(1);
    expect((await db.processingJob.findUniqueOrThrow({ where: { id: j.id } })).status).toBe("FAILED");
  });
});

describe("Postgres rate limiter", () => {
  const rule = { name: "pg-test", limit: 3, windowSeconds: 60 };
  afterEach(async () => {
    delete process.env.RATE_LIMIT_STORE;
    await resetRateLimit(rule, "ip-1");
  });

  it("counts in the rate_limits table and blocks over the limit", async () => {
    process.env.RATE_LIMIT_STORE = "postgres";
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await consume(rule, "ip-1"));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3]!.retryAfter).toBeGreaterThan(0);
    expect(results[3]!.retryAfter).toBeLessThanOrEqual(60);
    expect((await db.rateLimit.findUniqueOrThrow({ where: { key: "rl:pg-test:ip-1" } })).count).toBe(4);
  });
});
