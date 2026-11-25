import { describe, expect, it } from "vitest";
import { AUSTRALIA, CHINA, INDIA, USA, US_STATES } from "../src/countries";
import type { Country } from "../src/countries/types";
import { buildHexGrid, buildStatesLayout, resolutionToHexSize, tileAtPoint } from "../src/core/grid";
import { projectLngLat } from "../src/core/projection";
import { regionAtPoint, regionIdAtPoint, resolveRegion } from "../src/core/regions";

const at = (lng: number, lat: number, country: Country = USA) => {
  const p = projectLngLat(lng, lat, country)!;
  return regionAtPoint(p[0], p[1], country)?.code;
};

const ALL = [USA, INDIA, CHINA, AUSTRALIA];

describe("region lookup", () => {
  it("finds US states for well-known cities", () => {
    expect(at(-118.24, 34.05)).toBe("CA"); // Los Angeles
    expect(at(-97.74, 30.27)).toBe("TX"); // Austin
    expect(at(-87.63, 41.88)).toBe("IL"); // Chicago
    expect(at(-149.9, 61.22)).toBe("AK"); // Anchorage (inset)
    expect(at(-157.86, 21.31)).toBe("HI"); // Honolulu (inset)
    expect(at(-77.04, 38.9)).toBe("DC");
  });
  it("finds Indian states", () => {
    expect(at(72.88, 19.08, INDIA)).toBe("MH"); // Mumbai
    expect(at(77.59, 12.97, INDIA)).toBe("KA"); // Bengaluru
    expect(at(77.21, 28.61, INDIA)).toBe("DL"); // Delhi
    expect(at(88.36, 22.57, INDIA)).toBe("WB"); // Kolkata
  });
  it("uses India's official boundary in Kashmir", () => {
    expect(at(73.47, 34.37, INDIA)).toBe("JK"); // Muzaffarabad
    expect(at(74.31, 35.92, INDIA)).toBe("LA"); // Gilgit
    expect(at(79.5, 35.3, INDIA)).toBe("LA"); // Aksai Chin
    expect(at(77.58, 34.16, INDIA)).toBe("LA"); // Leh
    expect(at(74.8, 34.08, INDIA)).toBe("JK"); // Srinagar
  });
  it("finds Chinese provinces", () => {
    expect(at(121.47, 31.23, CHINA)).toBe("SH"); // Shanghai
    expect(at(116.4, 39.9, CHINA)).toBe("BJ"); // Beijing
    expect(at(104.07, 30.67, CHINA)).toBe("SC"); // Chengdu
    expect(at(114.12, 22.4, CHINA)).toBe("HK"); // Hong Kong (New Territories)
  });
  it("finds Australian states", () => {
    expect(at(151.21, -33.87, AUSTRALIA)).toBe("NSW"); // Sydney
    expect(at(144.96, -37.81, AUSTRALIA)).toBe("VIC"); // Melbourne
    expect(at(115.86, -31.95, AUSTRALIA)).toBe("WA"); // Perth
    expect(at(147.33, -42.88, AUSTRALIA)).toBe("TAS"); // Hobart
    expect(at(149.13, -35.28, AUSTRALIA)).toBe("ACT"); // Canberra
  });
  it("returns null in the ocean", () => {
    expect(regionIdAtPoint(5, 5)).toBeNull();
    expect(regionIdAtPoint(5, 5, AUSTRALIA)).toBeNull();
  });
  it("resolves regions by code, id and name", () => {
    expect(resolveRegion("ca")?.name).toBe("California");
    expect(resolveRegion(6)?.code).toBe("CA");
    expect(resolveRegion("Maharashtra", INDIA)?.code).toBe("MH");
    expect(resolveRegion("IN-MH", INDIA)?.code).toBe("MH");
    expect(resolveRegion("gd", CHINA)?.name).toBe("Guangdong");
    expect(resolveRegion("New South Wales", AUSTRALIA)?.code).toBe("NSW");
  });
});

describe("grid", () => {
  it("shrinks hexes as resolution increases", () => {
    const counts = [1, 4, 8].map((r) => buildHexGrid({ hexSize: resolutionToHexSize(r) }).tiles.length);
    expect(counts[0]).toBeGreaterThan(200);
    expect(counts[1]!).toBeGreaterThan(counts[0]!);
    expect(counts[2]!).toBeGreaterThan(counts[1]!);
  });
  it("gives similar tile counts for every country at the same resolution", () => {
    const us = buildHexGrid({ hexSize: resolutionToHexSize(7) }).tiles.length;
    for (const country of ALL) {
      const n = buildHexGrid({ country, hexSize: resolutionToHexSize(7) }).tiles.length;
      expect(n / us, country.id).toBeGreaterThan(0.85);
      expect(n / us, country.id).toBeLessThan(1.15);
    }
  });
  it("gives every region at least one tile", () => {
    for (const country of ALL) {
      const grid = buildHexGrid({ country, hexSize: resolutionToHexSize(1) });
      const covered = new Set(grid.tiles.map((t) => t.state.code));
      for (const s of country.regions) expect(covered, `${country.id} ${s.code}`).toContain(s.code);
    }
    expect(US_STATES).toHaveLength(51);
  });
  it("has unique tile ids", () => {
    const grid = buildHexGrid({ hexSize: 6 });
    expect(new Set(grid.tiles.map((t) => t.id)).size).toBe(grid.tiles.length);
  });
  it("only builds tiles within bounds", () => {
    const grid = buildHexGrid({ hexSize: 3, bounds: [100, 100, 300, 300] });
    expect(grid.tiles.length).toBeGreaterThan(0);
    for (const t of grid.tiles) {
      expect(t.x).toBeGreaterThanOrEqual(100);
      expect(t.x).toBeLessThanOrEqual(300);
    }
  });
  it("hit-tests tiles in both layouts", () => {
    const grid = buildHexGrid({ hexSize: 8 });
    const t = grid.tiles[42]!;
    expect(tileAtPoint(grid, t.x + 1, t.y - 1)?.id).toBe(t.id);
    const states = buildStatesLayout();
    const tx = states.byId.get("TX")!;
    expect(tileAtPoint(states, tx.x, tx.y)?.id).toBe("TX");
    expect(states.tiles.length).toBe(51);
  });
  it("states layout has one unique hex per region and fits the map space", () => {
    for (const country of ALL) {
      const layout = buildStatesLayout(country);
      expect(layout.tiles.length, country.id).toBe(country.regions.length);
      expect(new Set(layout.tiles.map((t) => `${t.q},${t.r}`)).size, country.id).toBe(layout.tiles.length);
      const { width, height } = country.geometry;
      for (const t of layout.tiles) {
        expect(t.x - layout.size).toBeGreaterThan(0);
        expect(t.x + layout.size).toBeLessThan(width);
        expect(t.y - layout.size).toBeGreaterThan(0);
        expect(t.y + layout.size).toBeLessThan(height);
        expect(tileAtPoint(layout, t.x, t.y)?.id).toBe(t.id);
      }
    }
  });
});
