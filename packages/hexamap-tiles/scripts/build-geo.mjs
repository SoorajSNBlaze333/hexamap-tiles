// Builds the bundled country geometry modules in src/countries/geo/.
//
// - USA: us-atlas' pre-projected states (Albers USA with Alaska/Hawaii insets, 975×610).
// - China, Australia: Natural Earth 1:50m admin-1 regions (public domain), vendored in geo-src/
//   (Hong Kong and Macau come from Natural Earth's admin-0 layer).
// - India: Natural Earth 1:10m admin-1 regions, extended to India's official boundary using Natural
//   Earth's India point-of-view country outline (see indiaOfficialFeatures below). Each is projected with a
//   conic equal-area projection and scaled so its land area matches the USA's, so a given
//   `resolution` produces a similar number of tiles in every country.
//
// Every polygon is simplified, rounded to 0.1 map units and stored as flat [x0, y0, x1, y1, ...] rings.
// Run: npm run build:geo -w hexamap-tiles
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { geoAlbersUsa, geoConicEqualArea, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import { topology } from "topojson-server";
import polygonClipping from "polygon-clipping";

const require = createRequire(import.meta.url);
const TOLERANCE = 0.25; // map units
const PAD = 12;

// ---------------------------------------------------------------- helpers

function sqSegDist(p, a, b) {
  let [x, y] = a;
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) [x, y] = b;
    else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

function simplify(points, tol) {
  if (points.length < 4) return points;
  const sq = tol * tol;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let max = 0;
    let index = 0;
    for (let i = first + 1; i < last; i++) {
      const d = sqSegDist(points[i], points[first], points[last]);
      if (d > max) {
        max = d;
        index = i;
      }
    }
    if (max > sq) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const round = (n) => Math.round(n * 10) / 10;
const flat = (pts) => pts.flatMap(([x, y]) => [round(x), round(y)]);
const polygonsOf = (g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);

function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return a / 2;
}

function ringCentroid(ring) {
  let x = 0, y = 0, a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    x += (ring[j][0] + ring[i][0]) * f;
    y += (ring[j][1] + ring[i][1]) * f;
    a += f;
  }
  return a === 0 ? ring[0] : [x / (3 * a), y / (3 * a)];
}

/** Turns projected (map-space) region features into the module's geometry arrays. */
function encode(features, idOf) {
  const regions = features.map((f) => {
    const rings = [];
    let largest = null;
    let largestArea = 0;
    for (const poly of polygonsOf(f.geometry)) {
      for (const ring of poly) {
        const area = Math.abs(ringArea(ring));
        if (area > largestArea) [largestArea, largest] = [area, ring];
        const s = simplify(ring, TOLERANCE);
        if (s.length >= 4) rings.push(flat(s));
      }
    }
    return { id: idOf(f), rings, center: largest ? ringCentroid(largest) : [0, 0] };
  });
  regions.sort((a, b) => a.id.localeCompare(b.id));

  const topo = topology({ regions: { type: "FeatureCollection", features } });
  const lines = (filter) =>
    mesh(topo, topo.objects.regions, filter)
      .coordinates.map((l) => simplify(l, TOLERANCE))
      .filter((l) => l.length >= 2)
      .map(flat);
  return { regions, borders: lines((a, b) => a !== b), outline: lines((a, b) => a === b) };
}

function totalArea(regions) {
  let a = 0;
  for (const r of regions) for (const ring of r.rings) {
    const pts = [];
    for (let i = 0; i < ring.length; i += 2) pts.push([ring[i], ring[i + 1]]);
    a += Math.abs(ringArea(pts));
  }
  return a;
}

// ---------------------------------------------------- automatic tile layout

/** Minimum-cost assignment (Hungarian algorithm) of n rows to m ≥ n columns. */
function hungarian(cost) {
  const n = cost.length, m = cost[0].length;
  const u = new Float64Array(n + 1), v = new Float64Array(m + 1);
  const p = new Int32Array(m + 1), way = new Int32Array(m + 1);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Float64Array(m + 1).fill(Infinity);
    const used = new Uint8Array(m + 1);
    do {
      used[j0] = 1;
      const i0 = p[j0];
      let delta = Infinity, j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) [minv[j], way[j]] = [cur, j0];
        if (minv[j] < delta) [delta, j1] = [minv[j], j];
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) [u[p[j]], v[j]] = [u[p[j]] + delta, v[j] - delta];
        else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const out = new Array(n);
  for (let j = 1; j <= m; j++) if (p[j]) out[p[j] - 1] = j - 1;
  return out;
}

/**
 * One hex per region, as close as possible to where the region really is: hexes are sized so the
 * country spans roughly `fill` × as many hexes as it has regions, then each region is assigned a
 * distinct hex by minimizing the total squared distance to the region centers.
 */
function autoTileLayout(regions, codeOf, area, fill = 0.7) {
  const n = regions.length;
  const s = Math.sqrt((area / (n * fill)) / ((3 * Math.sqrt(3)) / 2));
  const xs = regions.map((r) => r.center[0]), ys = regions.map((r) => r.center[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const hexes = [];
  const w = s * Math.sqrt(3);
  for (let row = Math.floor(y0 / (1.5 * s)) - 2; row <= Math.ceil(y1 / (1.5 * s)) + 2; row++) {
    for (let col = Math.floor(x0 / w) - 2; col <= Math.ceil(x1 / w) + 2; col++) {
      hexes.push({ col, row, x: w * (col + (row & 1) / 2), y: 1.5 * s * row });
    }
  }
  const cost = regions.map((r) => hexes.map((h) => (h.x - r.center[0]) ** 2 + (h.y - r.center[1]) ** 2));
  const pick = hungarian(cost).map((j) => hexes[j]);
  // Normalize to start at (0, 0), keeping row parity (odd-r offset).
  const minRow = Math.min(...pick.map((h) => h.row));
  const shiftRow = minRow - (minRow & 1);
  const minCol = Math.min(...pick.map((h) => h.col));
  const layout = {};
  regions.forEach((r, i) => (layout[codeOf(r)] = [pick[i].col - minCol, pick[i].row - shiftRow]));
  return layout;
}

// ------------------------------------------------------------------ output

const ringsTs = (rings) => `[${rings.map((r) => `[${r.join(",")}]`).join(",")}]`;

/** Encoded-polyline string for a flat [x0, y0, ...] array (see src/countries/encoding.ts). */
function encodeLine(flatLine) {
  let out = "";
  let px = 0;
  let py = 0;
  const put = (v) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    while (n >= 0x20) {
      out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    out += String.fromCharCode(n + 63);
  };
  for (let i = 0; i < flatLine.length; i += 2) {
    const x = Math.round(flatLine[i] * 10);
    const y = Math.round(flatLine[i + 1] * 10);
    put(x - px);
    put(y - py);
    px = x;
    py = y;
  }
  return out;
}
const encodeLines = (lines) => JSON.stringify(lines.map(encodeLine).join(" "));

function writeModule(file, constName, source, geo, extra = "") {
  const body = geo.regions.map((r) => `    ["${r.id}", ${encodeLines(r.rings)}]`).join(",\n");
  writeFileSync(
    new URL(`../src/countries/geo/${file}.ts`, import.meta.url),
    `// AUTO-GENERATED by scripts/build-geo.mjs — do not edit.
// Source: ${source}
// Lines are encoded polylines; see ../encoding.ts.
import type { EncodedCountryGeometry } from "../encoding";
import type { RegionInfo } from "../types";

export const ${constName}: EncodedCountryGeometry = {
  width: ${geo.width},
  height: ${geo.height},
  projection: ${JSON.stringify(geo.projection)},
  regions: [
${body},
  ],
  borders: ${encodeLines(geo.borders)},
  outline: ${encodeLines(geo.outline)},
};
${extra}`,
  );
  const points = geo.regions.reduce((n, r) => n + r.rings.reduce((m, ring) => m + ring.length / 2, 0), 0);
  console.log(`${file}: ${geo.regions.length} regions, ${points} points, ${geo.width}×${geo.height}`);
}

// --------------------------------------------------------------------- USA

const usTopo = JSON.parse(readFileSync(require.resolve("us-atlas/states-albers-10m.json"), "utf8"));
const usFeatures = feature(usTopo, usTopo.objects.states).features.filter((f) => f.id !== "72");
const us = encode(usFeatures, (f) => f.id);
const usLines = (filter) =>
  mesh(usTopo, usTopo.objects.states, filter).coordinates.map((l) => simplify(l, TOLERANCE)).filter((l) => l.length >= 2).map(flat);
// Use us-atlas' own topology for the US lines (its arcs are already shared exactly).
us.borders = usLines((a, b) => a !== b);
us.outline = usLines((a, b) => a === b);
const US_AREA = totalArea(us.regions);
writeModule("us", "US_GEOMETRY", "us-atlas states-albers-10m (Albers USA, 975×610).", {
  width: 975,
  height: 610,
  projection: { type: "albersUsa", scale: 1300, translate: [487.5, 305] },
  ...us,
});
void geoAlbersUsa;

// ----------------------------------------------------- India, China, Australia

const ne = JSON.parse(readFileSync(new URL("../geo-src/ne_50m_admin1_cn_au.geojson", import.meta.url), "utf8"));
const asMulti = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);

function polyArea(poly) {
  return poly.reduce((a, ring, i) => a + (i === 0 ? 1 : -1) * Math.abs(ringArea(ring)), 0);
}

/**
 * India's regions as shown on the Government of India's official map: Natural Earth's de facto
 * admin-1 regions, plus the areas inside India's official boundary that they leave out
 * (outline − regions). Pieces inside Pakistan-administered Azad Kashmir go to Jammu and Kashmir;
 * the rest (Gilgit-Baltistan, Aksai Chin, the Shaksgam valley) go to Ladakh, as on the 2019
 * official map.
 */
function indiaOfficialFeatures() {
  const src = JSON.parse(readFileSync(new URL("../geo-src/ne_10m_india_official.geojson", import.meta.url), "utf8"));
  const regions = src.features.filter((f) => f.properties.role === "region");
  const outline = asMulti(src.features.find((f) => f.properties.role === "india-official-outline").geometry);
  const ajk = asMulti(src.features.find((f) => f.properties.role === "azad-kashmir").geometry);

  const covered = polygonClipping.union(...regions.map((f) => asMulti(f.geometry)));
  // Only the Kashmir region; elsewhere the two layers differ by hairline slivers.
  const claimed = polygonClipping.difference(outline, covered).filter((poly) => {
    const [cx, cy] = ringCentroid(poly[0]);
    return cx > 72 && cx < 81 && cy > 32 && cy < 37.5 && polyArea(poly) > 0.005;
  });
  const toJK = polygonClipping.intersection(claimed, ajk);
  const toLA = polygonClipping.difference(claimed, ajk);
  const area = (mp) => mp.reduce((a, p) => a + polyArea(p), 0).toFixed(2);
  console.log(`India official boundary: +${area(toJK)} deg² to J&K, +${area(toLA)} deg² to Ladakh`);

  return regions.map((f) => {
    const iso = f.properties.iso_3166_2;
    const extra = iso === "IN-JK" ? toJK : iso === "IN-LA" ? toLA : null;
    const coordinates = extra ? polygonClipping.union(asMulti(f.geometry), extra) : asMulti(f.geometry);
    return {
      type: "Feature",
      properties: { name: f.properties.name, name_en: f.properties.name, iso_3166_2: iso, adm0_a3: "IND" },
      geometry: { type: "MultiPolygon", coordinates },
    };
  });
}
/** d3-geo wants exterior rings clockwise (negative planar area in lng/lat) and holes counter-clockwise. */
function rewindForD3(multi) {
  return multi.map((poly) =>
    poly.map((ring, i) => {
      const area = ringArea(ring);
      return (i === 0 ? area > 0 : area < 0) ? [...ring].reverse() : ring;
    }),
  );
}
const sourceFeatures = {
  IND: indiaOfficialFeatures().map((f) => ({ ...f, geometry: { ...f.geometry, coordinates: rewindForD3(f.geometry.coordinates) } })),
};

const COUNTRIES = [
  // bbox: [west, south, east, north] — rings outside are dropped (remote islands that would
  // stretch the map, e.g. Macquarie Island).
  { file: "in", constName: "IN_GEOMETRY", a3: "IND", parallels: [12, 28], rotate: [-80, 0], bbox: [67, 5, 99, 38] },
  { file: "cn", constName: "CN_GEOMETRY", a3: "CHN", parallels: [25, 47], rotate: [-105, 0], bbox: [72, 17.9, 136, 54] },
  { file: "au", constName: "AU_GEOMETRY", a3: "AUS", parallels: [-18, -36], rotate: [-134, 0], bbox: [112, -44.5, 154.5, -9] },
];

const codeOf = (iso) => iso.split("-")[1].replace(/~$/, "");

for (const c of COUNTRIES) {
  const inBox = ([lng, lat]) => lng >= c.bbox[0] && lng <= c.bbox[2] && lat >= c.bbox[1] && lat <= c.bbox[3];
  const geoFeatures = (sourceFeatures[c.a3] ?? ne.features.filter((f) => f.properties.adm0_a3 === c.a3))
    .map((f) => {
      const polys = polygonsOf(f.geometry).filter((poly) => poly[0].some(inBox));
      const iso = f.properties.iso_3166_2 === "AU-X02~" ? "AU-JBT" : f.properties.iso_3166_2;
      return {
        type: "Feature",
        id: iso,
        properties: { code: codeOf(iso), name: f.properties.name_en },
        geometry: { type: "MultiPolygon", coordinates: polys },
      };
    });

  const fc = { type: "FeatureCollection", features: geoFeatures };
  const projection = geoConicEqualArea().parallels(c.parallels).rotate(c.rotate).fitSize([1000, 1000], fc);
  // Scale so the country's land area equals the USA's in map units.
  const project = (p) => projection(p);
  const projectFeature = (f) => ({
    ...f,
    geometry: { type: "MultiPolygon", coordinates: f.geometry.coordinates.map((poly) => poly.map((ring) => ring.map(project))) },
  });
  let projected = geoFeatures.map(projectFeature);
  const area0 = totalArea(encode(projected, (f) => f.id).regions);
  const k = Math.sqrt(US_AREA / area0);
  const [[bx0, by0], [bx1, by1]] = geoPath(projection).bounds(fc);
  const [tx, ty] = projection.translate();
  projection.scale(projection.scale() * k).translate([k * (tx - bx0) + PAD, k * (ty - by0) + PAD]);
  projected = geoFeatures.map(projectFeature);

  const geo = encode(projected, (f) => f.id);
  const width = Math.ceil((bx1 - bx0) * k + 2 * PAD);
  const height = Math.ceil((by1 - by0) * k + 2 * PAD);
  const spec = {
    type: "conicEqualArea",
    parallels: c.parallels,
    rotate: c.rotate,
    scale: +projection.scale().toFixed(4),
    translate: projection.translate().map((v) => +v.toFixed(4)),
  };

  const regions = geoFeatures
    .map((f) => ({ id: f.id, code: f.properties.code, name: f.properties.name }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const auto = autoTileLayout(geo.regions, (r) => codeOf(r.id), totalArea(geo.regions));
  const extra = `
export const ${c.constName.replace("GEOMETRY", "REGIONS")}: RegionInfo[] = ${JSON.stringify(regions, null, 2).replace(/"(\w+)":/g, "$1:")};

/** Starting point for the hand-tuned tile layout (Hungarian assignment of region centers to hexes). */
export const ${c.constName.replace("GEOMETRY", "AUTO_TILE_LAYOUT")}: Record<string, [col: number, row: number]> = ${JSON.stringify(auto)};
`;
  writeModule(c.file, c.constName, c.a3 === "IND" ? `Natural Earth 1:10m admin-1 + India point-of-view boundary (public domain), conic equal-area.` : `Natural Earth 1:50m admin-1 (public domain), conic equal-area.`, { width, height, projection: spec, ...geo }, extra);
  printLayout(c.file, auto);
}

function printLayout(name, layout) {
  const rows = [];
  for (const [code, [col, row]] of Object.entries(layout)) (rows[row] ||= [])[col] = code;
  console.log(`\n${name} auto layout:`);
  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r] || [];
    let line = r & 1 ? "  " : "";
    for (let col = 0; col < cells.length; col++) line += (cells[col] ?? "·").padEnd(4);
    console.log(line);
  }
}
