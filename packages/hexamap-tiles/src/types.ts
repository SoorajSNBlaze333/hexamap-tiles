import type { Country, RegionInfo } from "./countries/types";

export type LayoutType = "grid" | "states";

/** A single hexagonal tile on the map. */
export interface HexTile {
  /** Stable id: "q,r" for grid layout, region code (e.g. "CA") for the states layout. */
  id: string;
  /** Axial coordinates on the layout's hex grid. */
  q: number;
  r: number;
  /** Center in the country's map space. */
  x: number;
  y: number;
  /** The state/province/territory this tile belongs to. */
  state: RegionInfo;
}

/** The computed set of tiles plus the grid parameters needed to address them. */
export interface HexLayout {
  type: LayoutType;
  country: Country;
  /** Hex radius (center to corner) in map units. */
  size: number;
  /** Map-space offset of the axial origin. */
  origin: [number, number];
  tiles: HexTile[];
  byId: Map<string, HexTile>;
}

/**
 * A data record. Each record is mapped to tiles by, in priority order:
 * `tileId` → `lat`/`lng` → `state` (region code, id or name — e.g. "CA", "06", "California",
 * "MH", "Maharashtra", "NSW").
 * Any other attributes are kept and available on `tile.data.items`.
 */
export interface HexDatum {
  tileId?: string;
  lat?: number;
  lng?: number;
  state?: string | number;
  value?: number;
  [key: string]: unknown;
}

export type AggregateFn<T extends HexDatum = HexDatum> = (items: T[], values: number[]) => number;
export type Aggregate<T extends HexDatum = HexDatum> = "sum" | "mean" | "count" | "min" | "max" | AggregateFn<T>;

export interface TileData<T extends HexDatum = HexDatum> {
  value: number;
  count: number;
  items: T[];
  /** Where the value came from. "state" means it was inherited from state-level data. */
  source: "tile" | "state";
}

export interface TileWithData<T extends HexDatum = HexDatum> extends HexTile {
  data?: TileData<T>;
}

export interface TileStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  /** Column height in the 3D view (map units). Ignored in 2D. */
  height: number;
}
