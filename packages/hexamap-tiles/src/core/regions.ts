import { USA } from "../countries/us";
import type { Country, RegionInfo } from "../countries/types";

interface IndexedRegion {
  id: string;
  rings: number[][];
  bbox: [number, number, number, number];
  labelPoint: [number, number];
}

interface CountryIndex {
  regions: IndexedRegion[];
  buckets: IndexedRegion[][];
  cols: number;
  byId: Map<string, RegionInfo>;
  byKey: Map<string, RegionInfo>;
  borders?: string;
  outline?: string;
}

const CELL = 20;
const indexes = new WeakMap<Country, CountryIndex>();

function ringArea(ring: number[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    a += ring[j]! * ring[i + 1]! - ring[i]! * ring[j + 1]!;
  }
  return a / 2;
}

function ringCentroid(ring: number[]): [number, number] {
  let x = 0;
  let y = 0;
  let a = 0;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const f = ring[j]! * ring[i + 1]! - ring[i]! * ring[j + 1]!;
    x += (ring[j]! + ring[i]!) * f;
    y += (ring[j + 1]! + ring[i + 1]!) * f;
    a += f;
  }
  return a === 0 ? [ring[0]!, ring[1]!] : [x / (3 * a), y / (3 * a)];
}

function getIndex(country: Country): CountryIndex {
  const cached = indexes.get(country);
  if (cached) return cached;
  const { width, height } = country.geometry;

  const regions: IndexedRegion[] = country.geometry.regions.map((s) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    let largest = s.rings[0] ?? [0, 0];
    let largestArea = 0;
    for (const ring of s.rings) {
      for (let i = 0; i < ring.length; i += 2) {
        const x = ring[i]!, y = ring[i + 1]!;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      const area = Math.abs(ringArea(ring));
      if (area > largestArea) {
        largestArea = area;
        largest = ring;
      }
    }
    return { id: s.id, rings: s.rings, bbox: [x0, y0, x1, y1], labelPoint: ringCentroid(largest) };
  });

  const cols = Math.ceil(width / CELL);
  const rows = Math.ceil(height / CELL);
  const buckets: IndexedRegion[][] = Array.from({ length: cols * rows }, () => []);
  for (const s of regions) {
    const [x0, y0, x1, y1] = s.bbox;
    for (let r = Math.max(0, Math.floor(y0 / CELL)); r <= Math.min(rows - 1, Math.floor(y1 / CELL)); r++) {
      for (let c = Math.max(0, Math.floor(x0 / CELL)); c <= Math.min(cols - 1, Math.floor(x1 / CELL)); c++) {
        buckets[r * cols + c]!.push(s);
      }
    }
  }

  const byId = new Map<string, RegionInfo>();
  const byKey = new Map<string, RegionInfo>();
  for (const r of country.regions) {
    byId.set(r.id, r);
    for (const k of [r.id, r.code, r.name]) byKey.set(k.toLowerCase(), r);
  }

  const index: CountryIndex = { regions, buckets, cols, byId, byKey };
  indexes.set(country, index);
  return index;
}

function inRings(x: number, y: number, rings: number[][]): boolean {
  // Even–odd rule across all rings handles multipolygons and holes.
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const xi = ring[i]!, yi = ring[i + 1]!, xj = ring[j]!, yj = ring[j + 1]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Id of the region containing a map-space point, or null. */
export function regionIdAtPoint(x: number, y: number, country: Country = USA): string | null {
  const { width, height } = country.geometry;
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  const { buckets, cols } = getIndex(country);
  const bucket = buckets[Math.floor(y / CELL) * cols + Math.floor(x / CELL)];
  if (!bucket) return null;
  for (const s of bucket) {
    const [x0, y0, x1, y1] = s.bbox;
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    if (inRings(x, y, s.rings)) return s.id;
  }
  return null;
}

/** The region containing a map-space point. */
export function regionAtPoint(x: number, y: number, country: Country = USA): RegionInfo | undefined {
  const id = regionIdAtPoint(x, y, country);
  return id ? getIndex(country).byId.get(id) : undefined;
}

/** @deprecated Use {@link regionIdAtPoint}. FIPS code of the US state at a map-space point. */
export const stateAtPoint = (x: number, y: number, country: Country = USA) => regionIdAtPoint(x, y, country);

/** Region by its id (FIPS for the USA, ISO 3166-2 elsewhere). */
export function regionById(id: string, country: Country = USA): RegionInfo | undefined {
  return getIndex(country).byId.get(id);
}

/**
 * Resolve a region from its code ("CA", "MH", "NSW"), id ("06", "IN-MH") or name
 * ("California", "Maharashtra"). Case-insensitive. Numbers are treated as US FIPS codes.
 */
export function resolveRegion(key: string | number, country: Country = USA): RegionInfo | undefined {
  const { byKey } = getIndex(country);
  if (typeof key === "number") return byKey.get(String(key).padStart(2, "0"));
  const k = key.trim().toLowerCase();
  return byKey.get(k) ?? (/^\d$/.test(k) ? byKey.get(`0${k}`) : undefined) ?? byKey.get(`${country.id}-${k}`);
}

/** @deprecated Use {@link resolveRegion}. */
export const resolveState = resolveRegion;

/** A representative interior-ish point for each region (centroid of its largest ring). */
export function regionLabelPoints(country: Country = USA): Array<{ id: string; point: [number, number] }> {
  return getIndex(country).regions.map((s) => ({ id: s.id, point: s.labelPoint }));
}

function linesToPath(lines: number[][]): string {
  let d = "";
  for (const line of lines) {
    for (let i = 0; i < line.length; i += 2) d += `${i === 0 ? "M" : "L"}${line[i]},${line[i + 1]}`;
  }
  return d;
}

/** SVG path data for borders between regions only — never the coastline or national boundary. */
export function regionBordersPath(country: Country = USA): string {
  const index = getIndex(country);
  return (index.borders ??= linesToPath(country.geometry.borders));
}

/** SVG path data for the country's outer boundary (map space). */
export function countryOutlinePath(country: Country = USA): string {
  const index = getIndex(country);
  return (index.outline ??= linesToPath(country.geometry.outline));
}
