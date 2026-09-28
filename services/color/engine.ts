/**
 * OCEANX tone & color engine.
 *
 * Pure per-pixel math (no I/O) applied to strips of float RGB data. Input and
 * output are sRGB-encoded values in 0…1 decoded from 16-bit samples, so grading
 * keeps full 16-bit precision. Neighbourhood operations (clarity, sharpening)
 * are applied afterwards by libvips — see services/color/grade.ts.
 */
import type { ColorAdjustments } from "@/lib/processing/settings";

export interface ToneExtras {
  /** Split toning: hue in degrees, strength 0…1 */
  shadowTint?: { hue: number; strength: number };
  highlightTint?: { hue: number; strength: number };
  /** Lifts the black point for a matte/film look, 0…0.15 */
  fade?: number;
  /** Convert to monochrome using the given channel weights */
  monochrome?: { r: number; g: number; b: number };
  /** Hue-selective saturation: e.g. boost blues/cyans for ocean looks */
  hueSaturation?: { hue: number; width: number; amount: number }[];
}

export interface EngineParams {
  adjustments: ColorAdjustments;
  extras?: ToneExtras;
  /** Linear-light channel multipliers applied before exposure (RAW white balance). */
  wbMultipliers?: [number, number, number];
  /** True when the input is linear light (RAW decode); false for sRGB-encoded images. */
  linearInput?: boolean;
}

// ---------------------------------------------------------------------------
// transfer functions
// ---------------------------------------------------------------------------
export function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
export function linearToSrgb(v: number): number {
  if (v <= 0) return 0;
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

const LUT_SIZE = 4096;
const toLinearLut = new Float32Array(LUT_SIZE + 1);
const toSrgbLut = new Float32Array(LUT_SIZE + 1);
for (let i = 0; i <= LUT_SIZE; i++) {
  toLinearLut[i] = srgbToLinear(i / LUT_SIZE);
  toSrgbLut[i] = linearToSrgb(i / LUT_SIZE);
}
function lut(table: Float32Array, v: number): number {
  if (v <= 0) return table[0]!;
  if (v >= 1) return table[LUT_SIZE]!;
  const x = v * LUT_SIZE;
  const i = x | 0;
  const f = x - i;
  return table[i]! + (table[i + 1]! - table[i]!) * f;
}

/** Highlight shoulder for linear values above 1 so exposure pushes roll off instead of clipping hard. */
function shoulder(v: number): number {
  if (v <= 0.8) return v;
  const x = v - 0.8;
  return 0.8 + 0.2 * (1 - Math.exp(-x / 0.2));
}

// ---------------------------------------------------------------------------
// white balance
// ---------------------------------------------------------------------------
/** Approximate linear-light RGB of a black-body radiator at the given Kelvin (normalised to G = 1). */
export function blackbodyRgb(kelvin: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  let r: number, g: number, b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const lin = [r, g, b].map((c) => srgbToLinear(Math.min(255, Math.max(1, c)) / 255)) as [number, number, number];
  return [lin[0] / lin[1], 1, lin[2] / lin[1]];
}

/**
 * Multipliers that neutralise a light source of `kelvin` relative to the
 * daylight (5500 K) reference that the RAW decoder was balanced to.
 */
export function kelvinMultipliers(kelvin: number, tint = 0): [number, number, number] {
  const ref = blackbodyRgb(5500);
  const src = blackbodyRgb(kelvin);
  const g = 1 - (tint / 150) * 0.3;
  const m: [number, number, number] = [ref[0] / src[0], g, ref[2] / src[2]];
  const norm = 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
  return [m[0] / norm, m[1] / norm, m[2] / norm];
}

/** Relative temperature/tint sliders (−100…100) used for grading already-rendered images. */
export function relativeWbMultipliers(temperature: number, tint: number): [number, number, number] {
  const t = temperature / 100;
  const ti = tint / 100;
  const m: [number, number, number] = [1 + 0.22 * t + 0.06 * ti, 1 - 0.18 * ti, 1 - 0.22 * t + 0.06 * ti];
  const norm = 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
  return [m[0] / norm, m[1] / norm, m[2] / norm];
}

// ---------------------------------------------------------------------------
// tone curve (applied to luminance, ratio-preserving so hue does not shift)
// ---------------------------------------------------------------------------
function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export function buildToneCurve(a: ColorAdjustments, fade = 0): Float32Array {
  const size = LUT_SIZE;
  const curve = new Float32Array(size + 1);
  const s = a.shadows / 100;
  const h = a.highlights / 100;
  const w = a.whites / 100;
  const b = a.blacks / 100;
  const c = a.contrast / 100;
  const whitePoint = 1 - Math.max(-0.5, Math.min(0.5, w * 0.2));
  const blackPoint = -b * 0.06;
  for (let i = 0; i <= size; i++) {
    let x = i / size;
    // levels: blacks & whites move the end points
    x = (x - blackPoint) / (whitePoint - blackPoint);
    x = Math.min(1.25, Math.max(0, x));
    // shadows lift/crush (peaks ≈ 1/3), highlights recover/boost (peaks ≈ 2/3)
    const xc = Math.min(1, x);
    x += s * 0.65 * xc * (1 - xc) * (1 - xc);
    x += h * 0.65 * xc * xc * (1 - xc);
    x = Math.min(1, Math.max(0, x));
    // contrast S-curve with fixed end points; monotonic for |c| ≤ 1
    x = x + 0.5 * c * (x - 0.5) * (1 - (2 * x - 1) * (2 * x - 1));
    // fade (matte blacks)
    if (fade > 0) x = fade + x * (1 - fade);
    curve[i] = Math.min(1, Math.max(0, x));
  }
  return curve;
}

// ---------------------------------------------------------------------------
// hue helpers
// ---------------------------------------------------------------------------
function hueOf(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 1e-6) return 0;
  let hh: number;
  if (max === r) hh = ((g - b) / d) % 6;
  else if (max === g) hh = (b - r) / d + 2;
  else hh = (r - g) / d + 4;
  hh *= 60;
  return hh < 0 ? hh + 360 : hh;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function hueToRgb(hue: number): [number, number, number] {
  const hh = ((hue % 360) + 360) % 360 / 60;
  const x = 1 - Math.abs((hh % 2) - 1);
  const table: [number, number, number][] = [
    [1, x, 0],
    [x, 1, 0],
    [0, 1, x],
    [0, x, 1],
    [x, 0, 1],
    [1, 0, x],
  ];
  return table[Math.floor(hh) % 6]!;
}

// ---------------------------------------------------------------------------
// main per-strip function
// ---------------------------------------------------------------------------
export interface CompiledEngine {
  apply(data: Float32Array): void;
}

export function compileEngine(p: EngineParams): CompiledEngine {
  const a = p.adjustments;
  const ex = p.extras ?? {};
  const expMul = Math.pow(2, a.exposure);
  const wb = p.wbMultipliers ?? (a.temperature !== 0 || a.tint !== 0 ? relativeWbMultipliers(a.temperature, a.tint) : [1, 1, 1]);
  const curve = buildToneCurve(a, ex.fade ?? 0);
  const sat = 1 + a.saturation / 100;
  const vib = a.vibrance / 100;
  const dehaze = a.dehaze / 100;
  const hazeK = dehaze > 0 ? dehaze * 0.05 : 0;
  const hazeAdd = dehaze < 0 ? -dehaze * 0.25 : 0;
  const shadowTint = ex.shadowTint ? hueToRgb(ex.shadowTint.hue).map((v) => (v - 0.5) * ex.shadowTint!.strength) : null;
  const highlightTint = ex.highlightTint
    ? hueToRgb(ex.highlightTint.hue).map((v) => (v - 0.5) * ex.highlightTint!.strength)
    : null;
  const mono = ex.monochrome;
  const hueSat = ex.hueSaturation ?? [];
  const linearInput = p.linearInput === true;
  const identityTone = a.shadows === 0 && a.highlights === 0 && a.whites === 0 && a.blacks === 0 && a.contrast === 0 && !ex.fade;

  return {
    apply(d: Float32Array) {
      for (let i = 0; i < d.length; i += 3) {
        // 1. into linear light
        let r = linearInput ? d[i]! : lut(toLinearLut, d[i]!);
        let g = linearInput ? d[i + 1]! : lut(toLinearLut, d[i + 1]!);
        let b = linearInput ? d[i + 2]! : lut(toLinearLut, d[i + 2]!);
        // 2. white balance and exposure (linear light, physically meaningful)
        r *= wb[0] * expMul;
        g *= wb[1] * expMul;
        b *= wb[2] * expMul;
        // 3. dehaze (atmospheric veil removal / addition)
        if (hazeK > 0) {
          r = Math.max(0, r - hazeK) / (1 - hazeK);
          g = Math.max(0, g - hazeK) / (1 - hazeK);
          b = Math.max(0, b - hazeK) / (1 - hazeK);
        } else if (hazeAdd > 0) {
          r = r * (1 - hazeAdd) + hazeAdd * 0.75;
          g = g * (1 - hazeAdd) + hazeAdd * 0.78;
          b = b * (1 - hazeAdd) + hazeAdd * 0.82;
        }
        // 4. highlight shoulder, back to display encoding
        r = lut(toSrgbLut, shoulder(r));
        g = lut(toSrgbLut, shoulder(g));
        b = lut(toSrgbLut, shoulder(b));
        // 5. tone curve on luminance, applied as a ratio to preserve hue
        let y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (!identityTone) {
          const y2 = lut(curve, y);
          if (y > 1e-4) {
            const k = y2 / y;
            r *= k;
            g *= k;
            b *= k;
          } else {
            r += y2 - y;
            g += y2 - y;
            b += y2 - y;
          }
          y = y2;
        }
        // 6. saturation, vibrance (skin-aware), dehaze saturation, hue-selective saturation
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const curSat = max > 1e-5 ? (max - min) / max : 0;
        let satMul = sat * (1 + dehaze * 0.15);
        if (vib !== 0 || hueSat.length) {
          const hue = hueOf(r, g, b);
          if (vib !== 0) {
            const skin = hueDistance(hue, 28) < 25 ? 0.5 : 1; // protect skin tones
            satMul *= 1 + vib * skin * (1 - curSat) * (1 - curSat);
          }
          for (const hs of hueSat) {
            const dist = hueDistance(hue, hs.hue);
            if (dist < hs.width) satMul *= 1 + hs.amount * (1 - dist / hs.width) * Math.min(1, curSat * 4);
          }
        }
        if (satMul !== 1) {
          r = y + (r - y) * satMul;
          g = y + (g - y) * satMul;
          b = y + (b - y) * satMul;
        }
        // 7. monochrome
        if (mono) {
          const m = mono.r * r + mono.g * g + mono.b * b;
          r = g = b = m;
        }
        // 8. split toning (weighted by luminance)
        if (shadowTint) {
          const wgt = 1 - smoothstep(0, 0.55, y);
          r += shadowTint[0]! * wgt;
          g += shadowTint[1]! * wgt;
          b += shadowTint[2]! * wgt;
        }
        if (highlightTint) {
          const wgt = smoothstep(0.45, 1, y);
          r += highlightTint[0]! * wgt;
          g += highlightTint[1]! * wgt;
          b += highlightTint[2]! * wgt;
        }
        d[i] = r < 0 ? 0 : r > 1 ? 1 : r;
        d[i + 1] = g < 0 ? 0 : g > 1 ? 1 : g;
        d[i + 2] = b < 0 ? 0 : b > 1 ? 1 : b;
      }
    },
  };
}
