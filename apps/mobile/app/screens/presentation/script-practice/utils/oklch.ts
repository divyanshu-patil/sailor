/**
 * OKLCH ⇄ sRGB hex, after Björn Ottosson's OKLab (2020).
 *
 * OKLCH is perceptually uniform where HSL is not: an equal step in L looks like
 * an equal step whatever the hue, and C means the same colourfulness at any
 * lightness. That is what lets the card ramp be monotonic in how it *looks*,
 * not just in its numbers.
 */

export interface Oklch {
  /** Lightness, 0–1. */
  l: number;
  /** Chroma, 0 to ~0.37. */
  c: number;
  /** Hue in degrees. */
  h: number;
}

const toLinear = (v: number) =>
  v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
const toGamma = (v: number) =>
  v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;

function linearRgb({ l: L, c: C, h: H }: Oklch): [number, number, number] {
  const rad = (H * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -1e-4 && v <= 1.0001);

/**
 * The sRGB hex for an OKLCH colour. Out of gamut, chroma is eased off until it
 * fits — hue and lightness are kept, which is what keeps a ramp's order.
 */
export function oklchToHex(color: Oklch): string {
  let c = color.c;
  let rgb = linearRgb({ ...color, c });
  while (!inGamut(rgb) && c > 0) {
    c = Math.max(0, c - 0.002);
    rgb = linearRgb({ ...color, c });
  }
  return `#${rgb
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, toGamma(v))) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** The OKLCH of an sRGB hex (#rgb or #rrggbb). */
export function hexToOklch(hex: string): Oklch {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : raw.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) =>
    toLinear(parseInt(full.slice(i, i + 2), 16) / 255),
  );
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.sqrt(A * A + B * B), h: h < 0 ? h + 360 : h };
}
