import { describe, expect, it } from "vitest";
import { assertDeletable, isMasterKey, keys, ProtectedKeyError } from "@/lib/storage/keys";

describe("storage key layout", () => {
  it("follows the documented structure", () => {
    expect(keys.master("proj123", "file123")).toBe("projects/proj123/masters/file123");
    expect(keys.version("proj123", "media123", "ver1234")).toBe("projects/proj123/versions/media123/ver1234");
    expect(keys.deliveryFile("deliv123", "file123")).toBe("deliveries/deliv123/files/file123");
    expect(keys.deliveryPackage("deliv123", "pack123")).toBe("deliveries/deliv123/packages/pack123.zip");
    expect(keys.deliveryPreview("deliv123", "file123", "preview.jpg")).toBe("deliveries/deliv123/previews/file123/preview.jpg");
  });
  it("rejects path traversal in ids", () => {
    expect(() => keys.master("../x", "file123")).toThrow();
    expect(() => keys.deliveryFile("deliv123", "a/b")).toThrow();
  });
});

describe("CRITICAL STORAGE RULE — cleanup can never delete masters", () => {
  const d = { deliveryId: "deliv123" };
  it("allows only keys inside the delivery prefix", () => {
    expect(() => assertDeletable("deliveries/deliv123/files/abcdef1", d)).not.toThrow();
    expect(() => assertDeletable("deliveries/deliv123/packages/p123456.zip", d)).not.toThrow();
  });
  it.each([
    "projects/p123456/masters/f123456",
    "projects/p123456/versions/m123456/v123456",
    "projects/p123456/previews/f123456/preview.jpg",
    "deliveries/OTHER12/files/f123456",
    "deliveries/deliv123/../../projects/p1/masters/f1",
    "deliveries/deliv1234/files/x",
    "/deliveries/deliv123/files/x",
    "uploads/m123456",
    "deliveries/deliv123/masters/x",
  ])("refuses %s", (key) => {
    expect(() => assertDeletable(key, d)).toThrow(ProtectedKeyError);
  });
  it("identifies master keys", () => {
    expect(isMasterKey("projects/a123456/masters/b123456")).toBe(true);
    expect(isMasterKey("deliveries/a123456/files/b123456")).toBe(false);
  });
  it("staging scope only permits that exact upload's staging object", () => {
    expect(() => assertDeletable("uploads/m123456", { stagingMediaId: "m123456" })).not.toThrow();
    expect(() => assertDeletable("uploads/other12", { stagingMediaId: "m123456" })).toThrow();
    expect(() => assertDeletable("projects/p123456/masters/m123456", { stagingMediaId: "m123456" })).toThrow();
  });
});
