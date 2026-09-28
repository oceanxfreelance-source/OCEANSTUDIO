import { describe, expect, it } from "vitest";
import { extensionOf, formatForFilename, RAW_EXTENSIONS, sanitizeFilename, SUPPORTED_EXTENSIONS, verifySignature } from "@/lib/file-types";

const tiffLE = Buffer.from([0x49, 0x49, 0x2a, 0x00, 8, 0, 0, 0]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftypisom")]);

describe("supported formats", () => {
  it("covers every required photo, RAW and video format", () => {
    for (const ext of ["nef", "dng", "cr2", "cr3", "arw", "raf", "orf", "rw2", "jpg", "jpeg", "png", "tif", "tiff", "webp", "mp4", "mov", "m4v", "avi", "mkv"]) {
      expect(SUPPORTED_EXTENSIONS).toContain(ext);
    }
    expect(RAW_EXTENSIONS).toContain("nef");
    expect(formatForFilename("DSC_1234.NEF")?.mediaType).toBe("RAW");
    expect(formatForFilename("clip.MOV")?.mediaType).toBe("VIDEO");
    expect(formatForFilename("evil.exe")).toBeNull();
  });
  it("never trusts the extension alone", () => {
    expect(verifySignature(formatForFilename("a.nef")!, tiffLE)).toBe(true);
    expect(verifySignature(formatForFilename("a.jpg")!, jpeg)).toBe(true);
    expect(verifySignature(formatForFilename("a.jpg")!, Buffer.from("<html>not an image"))).toBe(false);
    expect(verifySignature(formatForFilename("a.nef")!, jpeg)).toBe(false);
    expect(verifySignature(formatForFilename("a.mp4")!, mp4)).toBe(true);
    expect(verifySignature(formatForFilename("a.mp4")!, tiffLE)).toBe(false);
  });
  it("sanitizes filenames without losing them", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\photos\\DSC_0001.NEF")).toBe("DSC_0001.NEF");
    expect(sanitizeFilename("Été à Malé.jpg")).toBe("Été à Malé.jpg");
    expect(extensionOf("x.TIFF")).toBe("tiff");
  });
});
