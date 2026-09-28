import { describe, expect, it } from "vitest";
import { buildToneCurve, compileEngine, kelvinMultipliers, linearToSrgb, srgbToLinear } from "@/services/color/engine";
import { PRESETS, resolveGrade } from "@/services/color/presets";
import { COLOR_PRESETS, NEUTRAL_ADJUSTMENTS } from "@/lib/processing/settings";

function ramp(): Float32Array {
  const d = new Float32Array(3 * 1000);
  for (let i = 0; i < 1000; i++) {
    d[i * 3] = (i % 10) / 9;
    d[i * 3 + 1] = ((i / 10) % 10 | 0) / 9;
    d[i * 3 + 2] = ((i / 100) | 0) / 9;
  }
  return d;
}

describe("color engine", () => {
  it("transfer functions invert", () => {
    for (const v of [0, 0.001, 0.2, 0.5, 0.99, 1]) expect(linearToSrgb(srgbToLinear(v))).toBeCloseTo(v, 4);
  });
  it("neutral settings leave pixels unchanged (within 16-bit rounding)", () => {
    const d = ramp();
    const orig = Float32Array.from(d);
    compileEngine({ adjustments: NEUTRAL_ADJUSTMENTS }).apply(d);
    for (let i = 0; i < d.length; i++) expect(Math.abs(d[i]! - orig[i]!)).toBeLessThan(2 / 65535 + 1e-3);
  });
  it("tone curves stay monotonic at extreme settings", () => {
    for (const c of [-100, 100]) {
      const curve = buildToneCurve({ ...NEUTRAL_ADJUSTMENTS, contrast: c, shadows: c, highlights: -c, whites: c, blacks: -c });
      for (let i = 1; i < curve.length; i++) expect(curve[i]!).toBeGreaterThanOrEqual(curve[i - 1]! - 1e-6);
    }
  });
  it("exposure +1 EV doubles linear light in the midtones", () => {
    const d = new Float32Array([linearToSrgb(0.1), linearToSrgb(0.1), linearToSrgb(0.1)]);
    compileEngine({ adjustments: { ...NEUTRAL_ADJUSTMENTS, exposure: 1 } }).apply(d);
    expect(srgbToLinear(d[0]!)).toBeCloseTo(0.2, 2);
  });
  it("warm light is neutralised by kelvin white balance", () => {
    const [r, , b] = kelvinMultipliers(3200);
    expect(b).toBeGreaterThan(r); // tungsten scene → boost blue
    const [r2, , b2] = kelvinMultipliers(9000);
    expect(r2).toBeGreaterThan(b2);
  });
  it("black & white preset produces neutral pixels", () => {
    const d = ramp();
    const g = resolveGrade({ preset: "Black & White", intensity: 100, adjustments: {} });
    compileEngine({ adjustments: g.adjustments, extras: g.extras }).apply(d);
    for (let i = 0; i < d.length; i += 3) {
      expect(d[i]).toBeCloseTo(d[i + 1]!, 5);
      expect(d[i + 1]).toBeCloseTo(d[i + 2]!, 5);
    }
  });
  it("defines every required preset and scales by intensity", () => {
    for (const p of ["Natural", "Cinematic", "Maldives", "Ocean Blue", "Tropical", "Golden Hour", "Clean", "Moody", "Surf Documentary", "Black & White"]) {
      expect(COLOR_PRESETS).toContain(p);
      expect(PRESETS[p as keyof typeof PRESETS]).toBeDefined();
    }
    const full = resolveGrade({ preset: "Ocean Blue", intensity: 100, adjustments: {} });
    const half = resolveGrade({ preset: "Ocean Blue", intensity: 50, adjustments: {} });
    expect(half.adjustments.vibrance).toBeCloseTo(full.adjustments.vibrance / 2);
    const zero = resolveGrade({ preset: "Ocean Blue", intensity: 0, adjustments: {} });
    expect(zero.adjustments).toEqual(NEUTRAL_ADJUSTMENTS);
  });
});
