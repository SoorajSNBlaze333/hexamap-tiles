import type { Country, CountryGeometry } from "./types";

/**
 * Compact form of {@link CountryGeometry} used for the bundled countries. Every polyline/ring is a
 * string: coordinates × 10 as integers, delta-encoded and written with the "encoded polyline"
 * scheme (zig-zag, 5-bit groups, printable ASCII 63–126). Lines are separated by spaces.
 * This is ~4–5× smaller than plain number arrays and decodes in a few milliseconds.
 */
export interface EncodedCountryGeometry {
  width: number;
  height: number;
  projection: CountryGeometry["projection"];
  /** [region id, encoded rings] */
  regions: ReadonlyArray<readonly [id: string, rings: string]>;
  borders: string;
  outline: string;
}

const SCALE = 10;

/** Decodes a space-separated list of encoded polylines into flat [x0, y0, x1, y1, ...] arrays. */
export function decodeLines(encoded: string): number[][] {
  const out: number[][] = [];
  if (!encoded) return out;
  for (const part of encoded.split(" ")) {
    const line: number[] = [];
    let x = 0;
    let y = 0;
    let i = 0;
    let axis = 0;
    while (i < part.length) {
      let result = 0;
      let shift = 0;
      let b: number;
      do {
        b = part.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) {
        x += delta;
        line.push(x / SCALE);
      } else {
        y += delta;
        line.push(y / SCALE);
      }
      axis ^= 1;
    }
    out.push(line);
  }
  return out;
}

export function decodeGeometry(g: EncodedCountryGeometry): CountryGeometry {
  return {
    width: g.width,
    height: g.height,
    projection: g.projection,
    regions: g.regions.map(([id, rings]) => ({ id, rings: decodeLines(rings) })),
    borders: decodeLines(g.borders),
    outline: decodeLines(g.outline),
  };
}

/**
 * Builds a {@link Country} whose geometry is decoded the first time it's used, so importing a
 * country costs nothing until a map actually draws it.
 */
export function defineCountry(def: Omit<Country, "geometry"> & { encoded: EncodedCountryGeometry }): Country {
  const { encoded, ...rest } = def;
  let geometry: CountryGeometry | undefined;
  return {
    ...rest,
    get geometry() {
      return (geometry ??= decodeGeometry(encoded));
    },
  };
}
