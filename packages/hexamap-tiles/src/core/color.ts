// Small color utilities. Interpolation happens in OKLab for perceptually even gradients.

type RGB = [number, number, number];

export function parseHex(hex: string): RGB {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const fromLinear = (v: number) =>
  255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055);

function rgbToOklab([r8, g8, b8]: RGB): RGB {
  const r = toLinear(r8), g = toLinear(g8), b = toLinear(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, a, b]: RGB): RGB {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** Returns an interpolator t∈[0,1] → hex color across the given stops. */
export function interpolateColors(stops: string[]): (t: number) => string {
  if (stops.length === 0) return () => "#000000";
  if (stops.length === 1) return () => stops[0]!;
  const labs = stops.map((s) => rgbToOklab(parseHex(s)));
  return (t: number) => {
    const tt = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0)) * (labs.length - 1);
    const i = Math.min(labs.length - 2, Math.floor(tt));
    const f = tt - i;
    const a = labs[i]!, b = labs[i + 1]!;
    return toHex(oklabToRgb([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]));
  };
}

/** Relative luminance (0–1); useful for picking readable label colors. */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(toLinear) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const PALETTES = {
  blues: ["#eff6ff", "#bfdbfe", "#60a5fa", "#2563eb", "#1e3a8a"],
  teal: ["#f0fdfa", "#99f6e4", "#2dd4bf", "#0d9488", "#134e4a"],
  purples: ["#faf5ff", "#e9d5ff", "#c084fc", "#9333ea", "#581c87"],
  heat: ["#fef9c3", "#fcd34d", "#f97316", "#dc2626", "#7f1d1d"],
  viridis: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"],
  magma: ["#000004", "#3b0f70", "#8c2981", "#de4968", "#fe9f6d", "#fcfdbf"],
  plasma: ["#0d0887", "#7e03a8", "#cc4778", "#f89540", "#f0f921"],
  redBlue: ["#2563eb", "#93c5fd", "#f5f5f4", "#fca5a5", "#dc2626"],
} satisfies Record<string, string[]>;

export type PaletteName = keyof typeof PALETTES;
