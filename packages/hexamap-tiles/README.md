# hexamap-tiles

Hexagonal tile maps of the USA, India, China and Australia for React — built for analytics data.

[GitHub](https://github.com/SoorajSNBlaze333/hexamap-tiles) · [Issues](https://github.com/SoorajSNBlaze333/hexamap-tiles/issues) · MIT license

```bash
npm i hexamap-tiles framer-motion
```

```tsx
import { HexMap } from "hexamap-tiles";

<HexMap
  data={outages}                 // [{ lat, lng, value }, …] or [{ state: "TX", value }] or [{ tileId, value }]
  aggregate="sum"                // "sum" | "mean" | "count" | "min" | "max" | (items, values) => number
  resolution={7}                 // 1 (coarse) – 10 (fine), or "auto" to refine detail on zoom
  colorScale={{ type: "sequential", palette: "heat", transform: "sqrt" }}
  legend={{ title: "Customers without power" }}
  onTileClick={(tile) => console.log(tile.state.name, tile.data)}
/>
```

## Countries

`USA` is the default. Pass another country with the `country` prop. Only the countries you import end up in your
bundle.

```tsx
import { HexMap, INDIA } from "hexamap-tiles";

<HexMap country={INDIA} data={[{ state: "MH", value: 42 }, { lat: 12.97, lng: 77.59, value: 3 }]} />
```

| Export | Regions | Codes for `state` |
| --- | --- | --- |
| `USA` | 50 states + DC (Alaska and Hawaii as insets) | `"CA"`, FIPS `"06"`/`6`, or `"California"` |
| `INDIA` | 28 states + 8 union territories | `"MH"`, `"IN-MH"`, or `"Maharashtra"` |
| `CHINA` | 31 provinces/regions/municipalities + Hong Kong, Macau | `"GD"`, `"CN-GD"`, or `"Guangdong"` |
| `AUSTRALIA` | 6 states + 3 mainland territories | `"NSW"`, `"AU-NSW"`, or `"New South Wales"` |

Every country's map space is scaled to the same land area, so a given `resolution` gives a similar number of tiles
(about 3.9k at `7`) in each. `tile.state` is the tile's region (`{ id, code, name }`) whatever the country calls it.

Boundaries come from Natural Earth. India uses India's official boundary: Jammu & Kashmir includes
Pakistan-administered Kashmir, and Ladakh includes Gilgit-Baltistan and Aksai Chin, as on the 2019 official map. China
and Australia use Natural Earth's default (de facto) lines; China does not include Taiwan or the South China Sea islands.

## Layouts

- **`layout="grid"`** (default) — the country tessellated into hexes at any resolution. Lat/lng points are binned
  into tiles; state-level values fill every tile in that state. Alaska and Hawaii are shown as insets (Albers USA).
- **`layout="states"`** — one labelled hex per state/province, arranged to resemble the country.

## Key props

| Prop | Default | |
| --- | --- | --- |
| `country` | `USA` | `USA`, `INDIA`, `CHINA`, `AUSTRALIA`, or your own `Country` object |
| `resolution` | `7` | `1–10`, or `"auto"` (uses `autoResolution.base`, adds detail as you zoom, builds only visible tiles) |
| `hexSize` | — | Exact hex radius in map units; overrides `resolution` |
| `tileGap` | `0.05` | Gap between tiles as a fraction of the radius |
| `value` | `d => d.value ?? 1` | Numeric value of a record |
| `colorScale` | `{ type: "sequential" }` | `sequential` (with `linear`/`sqrt`/`log` transform), `quantize`, or `threshold` |
| `getTileStyle` | — | `(tile, ctx) => Partial<{ fill, stroke, strokeWidth, opacity, height }>` for full control |
| `showStateBorders` | `false` | Thin state lines over the tiles |
| `showOutline` | `false` | The country's real coastline/border drawn over the tiles (grid layout) |
| `tooltip` | `true` | `false`, or `(tile) => ReactNode` |
| `legend` | on when there's data | `false` or `{ title, position, format }`. `position` is `"below"` (default, under the map so it never covers tiles) or a corner to float it over the map |
| `zoom` | `true` | Drag to pan, pinch / ⌘+scroll to zoom, double-click to zoom in |
| `wheelZoom` | `"modifier"` | `"always"` to zoom on any scroll, `"off"` to disable |
| `selectedTileId` | — | Draws a selection outline |
| `entrance` | `"ripple"` | Staggered tile entrance when the map scrolls into view: `"ripple"`, `"sweep"`, `"fade"` or `"none"`. Replays when layout/resolution changes |
| `theme` | `"light"` | `"dark"`, `"auto"`, or a partial theme object. Every color can also be overridden in CSS via `--hm-<key>` |

## 3D view

The same map, tilted, with each tile's value shown as column height. It ships as a separate entry so
three.js is only loaded by apps that use it:

```bash
npm i three @react-three/fiber
```

```tsx
import { HexMap3D } from "hexamap-tiles/3d";

<HexMap3D
  data={outages}
  aggregate="sum"
  resolution={7}
  colorScale={{ type: "sequential", palette: "heat", transform: "sqrt" }}
  heightScale={110}   // tallest column, in map units (map is 975 wide)
  tilt={52}           // degrees from straight down
/>
```

It accepts the same data, layout, color, tooltip, legend, outline and theme props as `HexMap`, plus:

| Prop | Default | |
| --- | --- | --- |
| `heightScale` | `110` | Height of the tallest column |
| `baseHeight` | `1.5` | Height of tiles without data |
| `heightTransform` | color scale's transform | `"linear"`, `"sqrt"` or `"log"` mapping of value → height |
| `tilt` / `rotation` | `52` / `0` | Camera angle in degrees; the camera always frames the whole map |
| `controls` | `true` | Orbit (drag), zoom (pinch / ⌘+scroll), pan (right-drag) |
| `autoRotate` | `false` | Slow turntable spin |
| `shadows` | `true` | Columns cast shadows on each other |

`getTileStyle` can return `height` (map units) to set a column's height yourself. On load, the camera tilts from
top-down and the columns rise using the same `entrance` stagger as 2D.

## Headless utilities

Everything the component uses is exported: `buildHexGrid`, `buildStatesLayout`, `bindData`, `createColorScale`,
`projectLngLat`, `regionAtPoint`, `resolveRegion`, `tileAtPoint`, `PALETTES`, `US_STATES`, plus the hex math helpers.
The geometry helpers take the country as their last argument and default to `USA`.

## Bundle size

The package is ESM-only (Node ≥ 22.12 can also `require()` it). What an app ships, minified + gzipped, not
counting React and framer-motion:

| Import | Gzipped |
| --- | --- |
| `HexMap` (USA) | ~39 KB |
| + `INDIA` | +24 KB |
| + `CHINA` | +16 KB |
| + `AUSTRALIA` | +5 KB |
| + `HexMap3D` (three.js and @react-three/fiber not included) | +5 KB |

Countries you don't import are left out of your bundle. Bundled geometry is stored as encoded polylines
and decoded on first use (≈2 ms).

## Development

Geometry is generated by `npm run build:geo`: the USA from [us-atlas](https://github.com/topojson/us-atlas), the others
from [Natural Earth](https://www.naturalearthdata.com/) admin-1 regions (public domain, vendored in `geo-src/`). India's
official boundary is built by adding the areas inside Natural Earth's India point-of-view outline to J&K and Ladakh. The
script also prints a starting tile layout for each country, made by matching each region to the nearest hex; the
layouts in `src/countries/*.ts` are hand-tuned from that.
