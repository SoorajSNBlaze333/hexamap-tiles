import { describe, expect, it } from "vitest";
import { bindData } from "../src/core/bind";
import { buildHexGrid, buildStatesLayout } from "../src/core/grid";
import { createColorScale } from "../src/core/scale";

describe("bindData", () => {
  const grid = buildHexGrid({ hexSize: 10 });

  it("bins lat/lng points into grid tiles and sums", () => {
    const b = bindData(grid, [
      { lat: 41.88, lng: -87.63, value: 2 },
      { lat: 41.881, lng: -87.631, value: 3 },
    ]);
    expect(b.tiles.size).toBe(1);
    const [only] = [...b.tiles.values()];
    expect(only!.value).toBe(5);
    expect(only!.count).toBe(2);
  });

  it("supports aggregations", () => {
    const pts = [1, 5, 9].map((value) => ({ lat: 30.27, lng: -97.74, value }));
    expect([...bindData(grid, pts, { aggregate: "mean" }).tiles.values()][0]!.value).toBe(5);
    expect([...bindData(grid, pts, { aggregate: "max" }).tiles.values()][0]!.value).toBe(9);
    expect([...bindData(grid, pts, { aggregate: "count" }).tiles.values()][0]!.value).toBe(3);
  });

  it("falls back to state-level data on grid tiles", () => {
    const b = bindData(grid, [{ state: "Texas", value: 10 }]);
    const tx = grid.tiles.find((t) => t.state.code === "TX")!;
    expect(b.get(tx.id, "TX")).toMatchObject({ value: 10, source: "state" });
  });

  it("maps points and states onto the states layout", () => {
    const b = bindData(buildStatesLayout(), [
      { lat: 34.05, lng: -118.24 },
      { state: "06", value: 4 },
      { state: "ny", value: 2 },
    ]);
    expect(b.tiles.get("CA")?.value).toBe(5);
    expect(b.tiles.get("NY")?.value).toBe(2);
  });
});

describe("color scales", () => {
  it("sequential maps domain ends to palette ends", () => {
    const s = createColorScale({ type: "sequential", palette: ["#000000", "#ffffff"] }, [0, 10]);
    expect(s.color(0)).toBe("#000000");
    expect(s.color(10)).toBe("#ffffff");
    expect(s.domain).toEqual([0, 10]);
  });
  it("quantize buckets values", () => {
    const s = createColorScale({ type: "quantize", palette: ["#000000", "#ffffff"], steps: 2, domain: [0, 10] });
    expect(s.color(1)).toBe("#000000");
    expect(s.color(9)).toBe("#ffffff");
    expect(s.legend).toHaveLength(2);
  });
  it("threshold uses explicit breaks", () => {
    const s = createColorScale({ type: "threshold", thresholds: [10, 100], colors: ["#111111", "#222222", "#333333"] });
    expect(s.color(5)).toBe("#111111");
    expect(s.color(50)).toBe("#222222");
    expect(s.color(500)).toBe("#333333");
  });
});
