import type { Aggregate, HexDatum, HexLayout, TileData } from "../types";
import { hexId, pixelToHex } from "./hex";
import { projectLngLat } from "./projection";
import { regionAtPoint, resolveRegion } from "./regions";

export interface BindOptions<T extends HexDatum> {
  /** How to read a record's numeric value. Defaults to `d.value ?? 1`. */
  value?: (d: T) => number;
  /** How to combine records that land on the same tile. Default "sum". */
  aggregate?: Aggregate<T>;
}

export interface BoundData<T extends HexDatum = HexDatum> {
  /** Values keyed by tile id (from `tileId` or `lat`/`lng`). */
  tiles: Map<string, TileData<T>>;
  /** Values keyed by region code (from `state`). */
  states: Map<string, TileData<T>>;
  /** Look up the effective data for a tile: tile-level data wins over state-level. */
  get(tileId: string, regionCode: string): TileData<T> | undefined;
  /** All aggregated values (for scale domains). */
  values(): number[];
}

const defaultValue = (d: HexDatum) => (typeof d.value === "number" ? d.value : 1);

function reduce<T extends HexDatum>(items: T[], values: number[], agg: Aggregate<T>): number {
  if (typeof agg === "function") return agg(items, values);
  switch (agg) {
    case "count":
      return items.length;
    case "mean":
      return values.reduce((a, b) => a + b, 0) / (values.length || 1);
    case "min":
      return values.reduce((a, b) => (b < a ? b : a), Infinity);
    case "max":
      return values.reduce((a, b) => (b > a ? b : a), -Infinity);
    default:
      return values.reduce((a, b) => a + b, 0);
  }
}

/**
 * Assign records to tiles of a layout and aggregate them. In the grid layout,
 * lat/lng records are binned with hex math, so binning is independent of which
 * tiles are currently built (e.g. when only the visible viewport is built).
 */
export function bindData<T extends HexDatum>(
  layout: Pick<HexLayout, "type" | "size" | "origin" | "country">,
  data: readonly T[],
  { value = defaultValue, aggregate = "sum" }: BindOptions<T> = {},
): BoundData<T> {
  const tileBuckets = new Map<string, { items: T[]; values: number[] }>();
  const stateBuckets = new Map<string, { items: T[]; values: number[] }>();
  const push = (map: typeof tileBuckets, key: string, d: T) => {
    let b = map.get(key);
    if (!b) map.set(key, (b = { items: [], values: [] }));
    b.items.push(d);
    b.values.push(value(d));
  };

  for (const d of data) {
    if (d.tileId != null) {
      push(tileBuckets, String(d.tileId), d);
      continue;
    }
    if (typeof d.lat === "number" && typeof d.lng === "number") {
      const p = projectLngLat(d.lng, d.lat, layout.country);
      if (!p) continue;
      if (layout.type === "grid") {
        const { q, r } = pixelToHex(p[0] - layout.origin[0], p[1] - layout.origin[1], layout.size);
        push(tileBuckets, hexId(q, r), d);
      } else {
        const st = regionAtPoint(p[0], p[1], layout.country);
        if (st) push(tileBuckets, st.code, d);
      }
      continue;
    }
    if (d.state != null) {
      const st = resolveRegion(d.state, layout.country);
      if (!st) continue;
      if (layout.type === "states") push(tileBuckets, st.code, d);
      else push(stateBuckets, st.code, d);
    }
  }

  const finalize = (src: typeof tileBuckets, source: TileData["source"]) => {
    const out = new Map<string, TileData<T>>();
    for (const [k, b] of src) out.set(k, { value: reduce(b.items, b.values, aggregate), count: b.items.length, items: b.items, source });
    return out;
  };
  const tiles = finalize(tileBuckets, "tile");
  const states = finalize(stateBuckets, "state");

  return {
    tiles,
    states,
    get: (tileId, regionCode) => tiles.get(tileId) ?? states.get(regionCode),
    values: () => [...[...tiles.values()].map((t) => t.value), ...[...states.values()].map((t) => t.value)],
  };
}
