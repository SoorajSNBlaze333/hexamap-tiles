import { geoAlbersUsa, geoConicEqualArea, type GeoProjection } from "d3-geo";
import { USA } from "../countries/us";
import type { Country } from "../countries/types";

/** Width/height of the USA's map space (matches us-atlas' pre-projected files). */
export const MAP_WIDTH = 975;
export const MAP_HEIGHT = 610;

const cache = new WeakMap<Country, GeoProjection>();

/** The d3 projection that maps longitude/latitude into a country's map space. */
export function countryProjection(country: Country = USA): GeoProjection {
  let p = cache.get(country);
  if (p) return p;
  const spec = country.geometry.projection;
  if (spec.type === "albersUsa") p = geoAlbersUsa() as unknown as GeoProjection;
  else {
    const conic = geoConicEqualArea();
    if (spec.parallels) conic.parallels(spec.parallels as [number, number]);
    if (spec.rotate) conic.rotate(spec.rotate as [number, number]);
    p = conic;
  }
  p.scale(spec.scale).translate(spec.translate as [number, number]);
  cache.set(country, p);
  return p;
}

/**
 * Project a longitude/latitude into a country's map space. For the USA, returns null
 * outside the lower 48, Alaska and Hawaii.
 */
export function projectLngLat(lng: number, lat: number, country: Country = USA): [number, number] | null {
  return countryProjection(country)([lng, lat]);
}

/** Inverse of {@link projectLngLat}. */
export function unprojectPoint(x: number, y: number, country: Country = USA): [lng: number, lat: number] | null {
  return countryProjection(country).invert?.([x, y]) ?? null;
}
