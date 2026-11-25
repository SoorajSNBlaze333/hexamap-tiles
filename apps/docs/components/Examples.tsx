"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  HexMap,
  INDIA,
  USA,
  bindData,
  buildStatesLayout,
  type HexDatum,
  type TileWithData,
} from "hexamap-tiles";
import dynamic from "next/dynamic";
import { useMemo, useState, type ReactNode } from "react";
import { censusLabel, censusRecords, getDatasets } from "@/lib/sampleData";
import { useIsDark } from "@/lib/useIsDark";
import { CopyButton } from "./ui";

const HexMap3D = dynamic(() => import("hexamap-tiles/3d").then((m) => m.HexMap3D), {
  ssr: false,
  loading: () => <div className="grid aspect-[975/605] w-full place-items-center text-xs text-stone-400">Loading 3D…</div>,
});

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

interface Example {
  id: string;
  label: string;
  title: string;
  description: string;
  code: string;
  Preview: () => ReactNode;
}

function usePoints(id: "fires" | "quakes") {
  return useMemo(() => getDatasets("us").find((d) => d.id === id)!.load().data, [id]);
}

const EXAMPLES: Example[] = [
  {
    id: "points",
    label: "Points",
    title: "Bin lat/lng points into tiles",
    description:
      "Pass raw events with a latitude and longitude. Each one lands in the hex that contains it, and records sharing a tile are combined with `aggregate`.",
    code: `import { HexMap } from "hexamap-tiles";

const fires = [
  { lat: 39.76, lng: -121.62, frp: 41 },
  { lat: 34.21, lng: -118.53, frp: 12 },
  // …thousands more
];

<HexMap
  data={fires}
  aggregate="count"
  colorScale={{ type: "sequential", palette: "plasma", transform: "sqrt" }}
  valueLabel="Hotspots"
  legend={{ title: "Fire hotspots" }}
/>`,
    Preview: function Preview() {
      const dark = useIsDark();
      const data = usePoints("fires");
      return (
        <HexMap
          data={data}
          aggregate="count"
          colorScale={{ type: "sequential", palette: "plasma", transform: "sqrt" }}
          valueLabel="Hotspots"
          legend={{ title: "Fire hotspots" }}
          zoom={false}
          theme={dark ? "dark" : "light"}
        />
      );
    },
  },
  {
    id: "regions",
    label: "State values",
    title: "One value per state",
    description:
      "Already aggregated by state? Use `state` with a code, FIPS id or name. In the grid layout every tile in the state takes its value; `layout=\"states\"` draws one labelled hex per state.",
    code: `const population = [
  { state: "CA", value: 39_538_223 },
  { state: "TX", value: 29_145_505 },
  { state: "Florida", value: 21_538_187 }, // names work too
  { state: "36", value: 20_201_249 },      // …and FIPS codes
];

<HexMap
  layout="states"
  data={population}
  colorScale={{ type: "sequential", palette: "viridis", transform: "log" }}
  valueLabel="People"
  legend={{ title: "Population (2020 census)" }}
/>`,
    Preview: function Preview() {
      const dark = useIsDark();
      const data = useMemo(() => censusRecords("us"), []);
      return (
        <HexMap
          layout="states"
          data={data}
          colorScale={{ type: "sequential", palette: "viridis", transform: "log" }}
          valueLabel="People"
          legend={{ title: `Population (${censusLabel("us")})` }}
          zoom={false}
          theme={dark ? "dark" : "light"}
        />
      );
    },
  },
  {
    id: "countries",
    label: "Countries",
    title: "India, China and Australia",
    description:
      "Import a country and pass it as `country`. Region codes follow ISO 3166-2 (\"MH\", \"GD\", \"NSW\"). Countries you don't import are left out of your bundle.",
    code: `import { HexMap, INDIA } from "hexamap-tiles";

const population = [
  { state: "UP", value: 199_812_341 },
  { state: "Maharashtra", value: 112_374_333 },
  { state: "IN-BR", value: 104_099_452 },
  // …
];

<HexMap
  country={INDIA}
  data={population}
  resolution={6}
  colorScale={{ type: "quantize", palette: "teal", steps: 6 }}
  legend={{ title: "Population (2011 census)" }}
/>`,
    Preview: function Preview() {
      const dark = useIsDark();
      const data = useMemo(() => censusRecords("in"), []);
      return (
        <div className="mx-auto" style={{ maxWidth: 380 }}>
          <HexMap
            country={INDIA}
            data={data}
            resolution={6}
            colorScale={{ type: "quantize", palette: "teal", steps: 6 }}
            valueLabel="People"
            legend={{ title: `Population (${censusLabel("in")})` }}
            zoom={false}
            theme={dark ? "dark" : "light"}
          />
        </div>
      );
    },
  },
  {
    id: "3d",
    label: "3D",
    title: "Values as column heights",
    description:
      "The same props in 3D: the map tilts and each tile rises with its value. three.js only loads for apps that import `hexamap-tiles/3d`.",
    code: `// npm i three @react-three/fiber
import { HexMap3D } from "hexamap-tiles/3d";

<HexMap3D
  data={quakes}
  aggregate="count"
  colorScale={{ type: "sequential", palette: "magma", transform: "log" }}
  heightScale={110}   // tallest column, in map units
  tilt={52}           // degrees from top-down
  autoRotate
/>`,
    Preview: function Preview() {
      const dark = useIsDark();
      const data = usePoints("quakes");
      return (
        <HexMap3D
          data={data}
          aggregate="count"
          colorScale={{ type: "sequential", palette: "magma", transform: "log" }}
          valueLabel="Earthquakes"
          legend={{ title: "Earthquakes, M2.5+" }}
          autoRotate
          theme={dark ? "dark" : "light"}
        />
      );
    },
  },
  {
    id: "style",
    label: "Styling",
    title: "Custom tile styles, formats and tooltips",
    description:
      "`getTileStyle` runs after the color scale for full control over each hex. `format` controls numbers in the legend and tooltip, and `tooltip` can render anything.",
    code: `<HexMap
  layout="states"
  data={population}
  colorScale={{
    type: "threshold",
    thresholds: [2e6, 5e6, 10e6],
    colors: ["#dbeafe", "#93c5fd", "#3b82f6", "#1e3a8a"],
  }}
  format={(v) => \`\${(v / 1e6).toFixed(1)}M\`}
  getTileStyle={(tile) =>
    (tile.data?.value ?? 0) > 20e6 ? { stroke: "#f97316", strokeWidth: 3 } : undefined
  }
  tooltip={(tile) => (
    <div>
      <b>{tile.state.name}</b>
      <div>{((tile.data?.value ?? 0) / 1e6).toFixed(1)}M people</div>
    </div>
  )}
/>`,
    Preview: function Preview() {
      const dark = useIsDark();
      const data = useMemo(() => censusRecords("us"), []);
      return (
        <HexMap
          layout="states"
          data={data}
          colorScale={{ type: "threshold", thresholds: [2e6, 5e6, 10e6], colors: ["#dbeafe", "#93c5fd", "#3b82f6", "#1e3a8a"] }}
          format={(v) => `${(v / 1e6).toFixed(1)}M`}
          getTileStyle={(tile) => ((tile.data?.value ?? 0) > 20e6 ? { stroke: "#f97316", strokeWidth: 3 } : undefined)}
          tooltip={(tile: TileWithData<HexDatum>) => (
            <div style={{ fontSize: 12 }}>
              <b>{tile.state.name}</b>
              <div>{((tile.data?.value ?? 0) / 1e6).toFixed(1)}M people</div>
            </div>
          )}
          legend={{ title: "Population, highlighted above 20M" }}
          zoom={false}
          theme={dark ? "dark" : "light"}
        />
      );
    },
  },
  {
    id: "headless",
    label: "Headless",
    title: "Use the binning without the component",
    description:
      "Everything the map does is exported: build a layout, bind your records to it, and use the aggregates in a table, an API response or your own renderer.",
    code: `import { USA, bindData, buildStatesLayout } from "hexamap-tiles";

const layout = buildStatesLayout(USA);
const bound = bindData(layout, quakes, { aggregate: "count" });

const top = [...bound.tiles]
  .sort((a, b) => b[1].value - a[1].value)
  .slice(0, 5);
// → [["AK", { value: 1450, count: 1450, items: […] }], …]`,
    Preview: function Preview() {
      const data = usePoints("quakes");
      const rows = useMemo(() => {
        const layout = buildStatesLayout(USA);
        const bound = bindData(layout, data, { aggregate: "count" });
        return [...bound.tiles].sort((a, b) => b[1].value - a[1].value).slice(0, 6);
      }, [data]);
      const max = rows[0]?.[1].value ?? 1;
      return (
        <div className="space-y-2 p-2 sm:p-4">
          <div className="text-[11px] font-semibold tracking-wider text-stone-400 uppercase">Top states by earthquakes</div>
          {rows.map(([code, d], i) => (
            <div key={code} className="text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{buildStatesLayout(USA).byId.get(code)?.state.name ?? code}</span>
                <span className="font-mono text-stone-500 tabular-nums">{compact.format(d.value)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                <motion.div
                  className="h-full rounded-full bg-stone-800 dark:bg-stone-200"
                  initial={{ width: 0 }}
                  animate={{ width: `${(d.value / max) * 100}%` }}
                  transition={{ delay: 0.05 * i, type: "spring", stiffness: 200, damping: 30 }}
                />
              </div>
            </div>
          ))}
        </div>
      );
    },
  },
];

export function Examples() {
  const [active, setActive] = useState(EXAMPLES[0]!.id);
  const ex = EXAMPLES.find((e) => e.id === active)!;
  const Preview = ex.Preview;

  return (
    <section id="examples" className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
      <SectionHeading eyebrow="Examples" title="From raw events to a finished map" />
      <div className="mt-6 flex gap-1 overflow-x-auto pb-1">
        {EXAMPLES.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setActive(e.id)}
            className={`relative shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
              e.id === active ? "text-stone-900 dark:text-stone-50" : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
            }`}
          >
            {e.id === active && (
              <motion.span
                layoutId="example-tab"
                className="absolute inset-0 rounded-lg bg-stone-200/70 dark:bg-stone-800"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative">{e.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={ex.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="mt-3 grid gap-4 lg:grid-cols-2"
        >
          <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-stone-900 dark:border-stone-800 dark:bg-stone-900/60">
            <div className="border-b border-white/5 px-4 py-3">
              <div className="text-sm font-semibold text-stone-100">{ex.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-stone-400">{renderInlineCode(ex.description)}</p>
            </div>
            <div className="relative flex-1">
              <CopyButton text={ex.code} className="absolute top-2 right-2 text-stone-400! hover:bg-white/10! hover:text-white!" />
              <pre className="h-full overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-stone-300">
                <code>{ex.code}</code>
              </pre>
            </div>
          </div>
          <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-2 sm:p-4 dark:border-stone-800 dark:bg-stone-900">
            <Preview />
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

/** Renders `code` spans in a plain description string. */
function renderInlineCode(text: string) {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith("`") ? (
      <code key={i} className="rounded bg-white/10 px-1 py-px font-mono text-[11px] text-stone-200">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

export function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <div className="text-[11px] font-semibold tracking-wider text-stone-400 uppercase dark:text-stone-500">{eyebrow}</div>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h2>
      {children && <p className="mt-2 text-sm text-pretty text-stone-600 dark:text-stone-400">{children}</p>}
    </div>
  );
}
