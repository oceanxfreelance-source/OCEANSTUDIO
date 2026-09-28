import { describe, expect, it } from "vitest";
import { qualityLabel } from "@/lib/labels";
import { estimateOutput, photoJobSettingsSchema } from "@/lib/processing/settings";
import { upscalePasses } from "@/services/image/pipeline";

describe("quality labels never lie", () => {
  it("labels originals", () => {
    expect(qualityLabel({ versionType: "ORIGINAL", mediaType: "RAW", isAi: false })).toBe("ORIGINAL RAW");
    expect(qualityLabel({ versionType: "ORIGINAL", mediaType: "PHOTO", isAi: false })).toBe("ORIGINAL");
  });
  it("never labels processed output as ORIGINAL, and only AI output as AI", () => {
    const ai8 = qualityLabel({ versionType: "AI_ENHANCED", mediaType: "RAW", isAi: true, scale: 8 });
    const classical4 = qualityLabel({ versionType: "ENHANCED", mediaType: "PHOTO", isAi: false, scale: 4 });
    expect(ai8).toBe("AI ENHANCED 8×");
    expect(classical4).toBe("ENHANCED 4×");
    expect(classical4).not.toContain("AI");
    for (const l of [ai8, classical4]) expect(l).not.toContain("ORIGINAL");
    expect(qualityLabel({ versionType: "COLOR_GRADED", mediaType: "PHOTO", isAi: false, colorPreset: "Cinematic" })).toBe("COLOR GRADED · CINEMATIC");
    expect(qualityLabel({ versionType: "VIDEO_ENHANCED", mediaType: "VIDEO", isAi: false, videoResolution: "4k" })).toBe("4K ENHANCED");
  });
});

describe("processing settings", () => {
  it("requires explicit acknowledgement for 8× and Maximum", () => {
    const base = { sourceVersionId: "v1", enhance: { upscale: 8 } };
    expect(photoJobSettingsSchema.safeParse(base).success).toBe(false);
    expect(photoJobSettingsSchema.safeParse({ ...base, acknowledgeLargeOutput: true }).success).toBe(true);
    expect(photoJobSettingsSchema.safeParse({ sourceVersionId: "v1", enhance: { quality: "maximum" } }).success).toBe(false);
  });
  it("defaults face preservation ON and natural quality", () => {
    const s = photoJobSettingsSchema.parse({ sourceVersionId: "v1", enhance: {} });
    expect(s.enhance!.facePreservation).toBe(true);
    expect(s.enhance!.quality).toBe("natural");
    expect(s.output.format).toBe("tiff16");
  });
  it("requires at least one operation", () => {
    expect(photoJobSettingsSchema.safeParse({ sourceVersionId: "v1" }).success).toBe(false);
  });
  it("composes 8× from native passes", () => {
    expect(upscalePasses(8, [2, 4])).toEqual([4, 2]);
    expect(upscalePasses(8, [2])).toEqual([2, 2, 2]);
    expect(upscalePasses(4, [2])).toEqual([2, 2]);
    expect(upscalePasses(1, [2, 4])).toEqual([]);
  });
  it("estimates 8× output", () => {
    const e = estimateOutput(3000, 2000, 8, "tiff16");
    expect(e.width).toBe(24000);
    expect(e.height).toBe(16000);
    expect(e.megapixels).toBe(384);
  });
});
