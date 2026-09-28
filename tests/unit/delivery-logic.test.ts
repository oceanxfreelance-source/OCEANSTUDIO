import { describe, expect, it } from "vitest";
import { deliveryState } from "@/lib/auth/client";
import { displayStatus } from "@/server/deliveries";
import { planZipParts, uniqueNames } from "@/services/zip/package";
import { planTiles } from "@/services/ai/replicate";

const H = 3600_000;

describe("server-side expiration", () => {
  const created = new Date("2026-09-28T10:00:00Z");
  const expiresAt = new Date(created.getTime() + 48 * H);
  it("expires exactly 48 hours after creation", () => {
    expect(expiresAt.toISOString()).toBe("2026-09-30T10:00:00.000Z");
  });
  it("denies access at current_time >= expires_at even before cleanup runs", () => {
    const d = { status: "ACTIVE" as const, expiresAt };
    expect(deliveryState(d, new Date(expiresAt.getTime() - 1))).toBe("ok");
    expect(deliveryState(d, expiresAt)).toBe("expired");
    expect(deliveryState(d, new Date(expiresAt.getTime() + 1))).toBe("expired");
  });
  it("revoked, deleted and preparing deliveries are not accessible", () => {
    expect(deliveryState({ status: "REVOKED", expiresAt }, created)).toBe("revoked");
    expect(deliveryState({ status: "DELETED", expiresAt }, created)).toBe("expired");
    expect(deliveryState({ status: "PREPARING", expiresAt }, created)).toBe("preparing");
    expect(deliveryState(null, created)).toBe("not_found");
  });
  it("derives EXPIRING SOON without storing it", () => {
    expect(displayStatus({ status: "ACTIVE", expiresAt }, new Date(expiresAt.getTime() - 2 * H))).toBe("EXPIRING SOON");
    expect(displayStatus({ status: "ACTIVE", expiresAt }, created)).toBe("ACTIVE");
    expect(displayStatus({ status: "ACTIVE", expiresAt }, expiresAt)).toBe("EXPIRED");
  });
});

describe("zip packaging", () => {
  it("splits very large collections into parts", () => {
    const files = Array.from({ length: 10 }, (_, i) => ({ key: `k${i}`, filename: `f${i}.jpg`, size: 3 }));
    const parts = planZipParts(files, 10);
    expect(parts.map((p) => p.length)).toEqual([3, 3, 3, 1]);
    expect(planZipParts([{ key: "big", filename: "b", size: 50 }], 10)).toHaveLength(1);
  });
  it("de-duplicates names inside one archive", () => {
    const names = uniqueNames([
      { key: "a", filename: "DSC_1.jpg", size: 1 },
      { key: "b", filename: "DSC_1.jpg", size: 1 },
    ]).map((e) => e.filename);
    expect(names).toEqual(["DSC_1.jpg", "DSC_1 (2).jpg"]);
  });
});

describe("AI tiling", () => {
  it("keeps padded tiles under the provider pixel limit", () => {
    const plan = planTiles(6000, 4000, 1_440_000);
    expect((plan.tileW + 2 * plan.overlap) * (plan.tileH + 2 * plan.overlap)).toBeLessThanOrEqual(1_440_000);
    expect(plan.cols * plan.tileW).toBeGreaterThanOrEqual(6000);
    expect(plan.rows * plan.tileH).toBeGreaterThanOrEqual(4000);
  });
});
