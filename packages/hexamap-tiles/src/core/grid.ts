import { USA } from "../countries/us";
import type { Country } from "../countries/types";
import type { HexLayout, HexTile } from "../types";
import { SQRT3, axialRound, hexId, hexToPixel, offsetToAxial, pixelToHex } from "./hex";
import { regionById, regionIdAtPoint, regionLabelPoints, resolveRegion } from "./regions";

export const MIN_RESOLUTION = 1;
export const MAX_RESOLUTION = 10;

/**
 * Hex radius (map units) for a resolution level. Each level shrinks tiles by
 * 20%: level 1 ≈ 270 tiles, 7 ≈ 3.9k, 10 ≈ 15k. Every bundled country's map
 * space is scaled to the same land area, so counts are similar for each of them.
 */
export function resolutionToHexSize(resolution: number): number {
  const r = Math.min(MAX_RESOLUTION, Math.max(MIN_RESOLUTION, resolution));
  return 22 * Math.pow(0.8, r - 1);
}

export type Bounds = [x0: number, y0: number, x1: number, y1: number];

export interface GridOptions {
  /** Which country to tile. Default `USA`. */
  country?: Country;
  /** Hex radius in map units. */
  hexSize: number;
  /** Only build tiles whose centers fall inside these map-space bounds. Defaults to the whole map. */
  bounds?: Bounds;
  /**
   * Guarantee every region gets at least one tile, even when it's smaller than a
   * hex (DC, RI, DE at low resolutions). Default true.
   */
  ensureEveryState?: boolean;
}

const gridCache = new Map<string, HexLayout>();

export function buildHexGrid({ country = USA, hexSize, bounds, ensureEveryState = true }: GridOptions): HexLayout {
  const { width, height } = country.geometry;
  const [bx0, by0, bx1, by1] = bounds ?? [0, 0, width, height];
  const x0 = Math.max(0, bx0), y0 = Math.max(0, by0), x1 = Math.min(width, bx1), y1 = Math.min(height, by1);
  const key = `${country.id}|${hexSize.toFixed(4)}|${x0.toFixed(0)},${y0.toFixed(0)},${x1.toFixed(0)},${y1.toFixed(0)}|${ensureEveryState}`;
  const cached = gridCache.get(key);
  if (cached) return cached;

  const tiles: HexTile[] = [];
  const byId = new Map<string, HexTile>();
  const counts = new Map<string, number>();
  const w = hexSize * SQRT3;

  const rMin = Math.floor(y0 / (hexSize * 1.5)) - 1;
  const rMax = Math.ceil(y1 / (hexSize * 1.5)) + 1;
  for (let r = rMin; r <= rMax; r++) {
    const qMin = Math.floor(x0 / w - r / 2) - 1;
    const qMax = Math.ceil(x1 / w - r / 2) + 1;
    for (let q = qMin; q <= qMax; q++) {
      const [x, y] = hexToPixel(q, r, hexSize);
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const rid = regionIdAtPoint(x, y, country);
      if (!rid) continue;
      const state = regionById(rid, country);
      if (!state) continue;
      const tile: HexTile = { id: hexId(q, r), q, r, x, y, state };
      tiles.push(tile);
      byId.set(tile.id, tile);
      counts.set(rid, (counts.get(rid) ?? 0) + 1);
    }
  }

  if (ensureEveryState) {
    const forced = new Set<string>();
    const neighbors = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]] as const;
    for (const { id: rid, point } of regionLabelPoints(country)) {
      if (counts.get(rid)) continue;
      const [px, py] = point;
      if (px < x0 || px > x1 || py < y0 || py > y1) continue;
      const state = regionById(rid, country);
      if (!state) continue;
      const home = pixelToHex(px, py, hexSize);
      // Closest hex to the state's label point that another tiny state hasn't already claimed.
      const candidates = neighbors
        .map(([dq, dr]) => {
          const q = home.q + dq, r = home.r + dr;
          const [x, y] = hexToPixel(q, r, hexSize);
          return { q, r, x, y, d: Math.hypot(x - px, y - py) };
        })
        .filter((c) => !forced.has(hexId(c.q, c.r)))
        .sort((a, b) => a.d - b.d);
      const c = candidates[0];
      if (!c) continue;
      const id = hexId(c.q, c.r);
      const tile: HexTile = { id, q: c.q, r: c.r, x: c.x, y: c.y, state };
      const existing = byId.get(id);
      if (existing) {
        tiles[tiles.indexOf(existing)] = tile;
        counts.set(existing.state.id, (counts.get(existing.state.id) ?? 1) - 1);
      } else tiles.push(tile);
      byId.set(id, tile);
      forced.add(id);
      counts.set(rid, 1);
    }
  }

  const layout: HexLayout = { type: "grid", country, size: hexSize, origin: [0, 0], tiles, byId };
  if (gridCache.size > 64) gridCache.clear();
  gridCache.set(key, layout);
  return layout;
}

const statesLayouts = new WeakMap<Country, HexLayout>();

/** The one-hex-per-region cartogram (`country.tileLayout`), fitted to the country's map space. */
export function buildStatesLayout(country: Country = USA): HexLayout {
  const cached = statesLayouts.get(country);
  if (cached) return cached;
  const { width, height } = country.geometry;
  const cells = Object.entries(country.tileLayout).map(([code, [col, row]]) => {
    const { q, r } = offsetToAxial(col, row);
    const [x, y] = hexToPixel(q, r, 1);
    return { code, q, r, x, y };
  });
  // Extent of the hexes (unit size): centers ± √3/2 horizontally, ± 1 vertically.
  const minX = Math.min(...cells.map((c) => c.x)) - SQRT3 / 2;
  const maxX = Math.max(...cells.map((c) => c.x)) + SQRT3 / 2;
  const minY = Math.min(...cells.map((c) => c.y)) - 1;
  const maxY = Math.max(...cells.map((c) => c.y)) + 1;
  const padding = 16;
  const size = Math.min((width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY));
  const origin: [number, number] = [
    (width - (maxX - minX) * size) / 2 - minX * size,
    (height - (maxY - minY) * size) / 2 - minY * size,
  ];

  const tiles: HexTile[] = [];
  const byId = new Map<string, HexTile>();
  for (const c of cells) {
    const state = resolveRegion(c.code, country);
    if (!state) continue;
    const tile: HexTile = { id: c.code, q: c.q, r: c.r, x: c.x * size + origin[0], y: c.y * size + origin[1], state };
    tiles.push(tile);
    byId.set(c.code, tile);
  }
  const layout: HexLayout = { type: "states", country, size, origin, tiles, byId };
  statesLayouts.set(country, layout);
  return layout;
}

/** Find the tile under a map-space point. */
export function tileAtPoint(layout: HexLayout, x: number, y: number): HexTile | undefined {
  const { q, r } = axialRound(
    ((SQRT3 / 3) * (x - layout.origin[0]) - (y - layout.origin[1]) / 3) / layout.size,
    ((2 / 3) * (y - layout.origin[1])) / layout.size,
  );
  if (layout.type === "grid") return layout.byId.get(hexId(q, r));
  for (const t of layout.tiles) if (t.q === q && t.r === r) return t;
  return undefined;
}
