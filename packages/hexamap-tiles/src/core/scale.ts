import { PALETTES, type PaletteName, interpolateColors } from "./color";

type Palette = PaletteName | string[];

export type ColorScaleConfig =
  | {
      /** Continuous gradient between domain min and max. */
      type: "sequential";
      palette?: Palette;
      /** Defaults to the [min, max] of the bound data. */
      domain?: [number, number];
      /** Compress skewed data. Default "linear". */
      transform?: "linear" | "log" | "sqrt";
    }
  | {
      /** Domain split into `steps` equal buckets, each a flat color. */
      type: "quantize";
      palette?: Palette;
      steps?: number;
      domain?: [number, number];
    }
  | {
      /** Explicit breakpoints; `colors.length` must be `thresholds.length + 1`. */
      type: "threshold";
      thresholds: number[];
      colors: string[];
    };

export interface LegendStop {
  color: string;
  /** Lower bound of this bucket (or the value at this gradient stop). */
  from: number;
  to?: number;
}

export interface ColorScale {
  type: ColorScaleConfig["type"];
  domain: [number, number];
  color(value: number): string;
  /** Gradient stops (sequential) or discrete buckets (quantize/threshold), for legends. */
  legend: LegendStop[];
}

const resolvePalette = (p: Palette | undefined) => (Array.isArray(p) ? p : PALETTES[p ?? "blues"]);

export function extent(values: Iterable<number>): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min === Infinity ? [0, 1] : [min, max];
}

export function createColorScale(config: ColorScaleConfig, values: Iterable<number> = []): ColorScale {
  if (config.type === "threshold") {
    const { thresholds, colors } = config;
    const ext = extent(values);
    return {
      type: "threshold",
      domain: ext,
      color(v) {
        let i = 0;
        while (i < thresholds.length && v >= thresholds[i]!) i++;
        return colors[Math.min(i, colors.length - 1)] ?? "#000";
      },
      legend: colors.map((color, i) => ({
        color,
        from: i === 0 ? Math.min(ext[0], thresholds[0] ?? ext[0]) : thresholds[i - 1]!,
        to: thresholds[i] ?? Math.max(ext[1], thresholds[thresholds.length - 1] ?? ext[1]),
      })),
    };
  }

  const domain = config.domain ?? extent(values);
  const [d0, d1] = domain;
  const palette = resolvePalette(config.palette);
  const interp = interpolateColors(palette);

  if (config.type === "quantize") {
    const steps = Math.max(2, config.steps ?? 5);
    const colors = Array.from({ length: steps }, (_, i) => interp(i / (steps - 1)));
    const span = d1 - d0 || 1;
    return {
      type: "quantize",
      domain,
      color(v) {
        const i = Math.floor(((v - d0) / span) * steps);
        return colors[Math.min(steps - 1, Math.max(0, i))]!;
      },
      legend: colors.map((color, i) => ({ color, from: d0 + (span * i) / steps, to: d0 + (span * (i + 1)) / steps })),
    };
  }

  const transform = config.transform ?? "linear";
  const f =
    transform === "log"
      ? (v: number) => Math.log10(Math.max(v, 1e-9))
      : transform === "sqrt"
        ? (v: number) => Math.sqrt(Math.max(0, v))
        : (v: number) => v;
  const t0 = f(transform === "log" ? Math.max(d0, 1e-9) : d0);
  const t1 = f(d1);
  const tspan = t1 - t0 || 1;
  const color = (v: number) => interp((f(v) - t0) / tspan);
  const legend = palette.map((_, i) => {
    const t = i / (palette.length - 1);
    const tv = t0 + tspan * t;
    const from = transform === "log" ? Math.pow(10, tv) : transform === "sqrt" ? tv * tv : tv;
    return { color: interp(t), from };
  });
  return { type: "sequential", domain, color, legend };
}
