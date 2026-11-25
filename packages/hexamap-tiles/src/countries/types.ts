/** A first-level administrative region: a US state, an Indian state/UT, a Chinese province… */
export interface RegionInfo {
  /** Stable id: FIPS code for the USA ("06"), ISO 3166-2 elsewhere ("IN-MH"). */
  id: string;
  /** Short code shown on tiles: "CA", "MH", "GD", "NSW". */
  code: string;
  name: string;
}

/** Pre-projected geometry bundled for a country. Map space is `width` × `height` units. */
export interface CountryGeometry {
  width: number;
  height: number;
  projection: {
    type: "albersUsa" | "conicEqualArea" | (string & {});
    scale: number;
    translate: number[];
    parallels?: number[];
    rotate?: number[];
  };
  /** Region polygons. Each ring is a flat [x0, y0, x1, y1, ...] array. */
  regions: ReadonlyArray<{ id: string; rings: number[][] }>;
  /** Lines between regions only (no coastline or national border). */
  borders: number[][];
  /** The country's outer boundary/coastline. */
  outline: number[][];
}

export interface Country {
  /** "us", "in", "cn", "au". */
  id: string;
  name: string;
  /** What the regions are called, e.g. "State" or "Province". */
  regionNoun: string;
  regions: readonly RegionInfo[];
  geometry: CountryGeometry;
  /** One-hex-per-region cartogram in odd-r offset coordinates (odd rows shift half a hex right). */
  tileLayout: Readonly<Record<string, readonly [col: number, row: number]>>;
}
