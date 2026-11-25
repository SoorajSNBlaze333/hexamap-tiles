"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AUSTRALIA,
  CHINA,
  HexMap,
  INDIA,
  PALETTES,
  USA,
  type Country,
  buildHexGrid,
  resolutionToHexSize,
  type HexDatum,
  type PaletteName,
  type TileWithData,
} from "hexamap-tiles";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { getDatasets, type CountryId, type Dataset } from "@/lib/sampleData";
import { useIsDark } from "@/lib/useIsDark";
import { CopyButton, Field, Segmented, Slider, Toggle } from "./ui";

// three.js only loads when the 3D view is first opened.
const HexMap3D = dynamic(() => import("hexamap-tiles/3d").then((m) => m.HexMap3D), {
  ssr: false,
  loading: () => <div className="grid aspect-[975/610] w-full place-items-center text-xs text-stone-400">Loading 3D…</div>,
});

const COUNTRIES: Record<CountryId, { country: Country; label: string; constName: string }> = {
  us: { country: USA, label: "USA", constName: "USA" },
  in: { country: INDIA, label: "India", constName: "INDIA" },
  cn: { country: CHINA, label: "China", constName: "CHINA" },
  au: { country: AUSTRALIA, label: "Australia", constName: "AUSTRALIA" },
};

/** Tallest the map should get on a desktop screen (px); wide countries just fill the width. */
const MAX_MAP_HEIGHT = 640;

const PALETTE_OPTIONS: PaletteName[] = ["heat", "purples", "teal", "blues", "viridis", "magma", "plasma"];
const fmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function Playground() {
  const dark = useIsDark();
  const [countryId, setCountryId] = useState<CountryId>("us");
  const { country } = COUNTRIES[countryId];
  const datasets = useMemo(() => getDatasets(countryId), [countryId]);
  const [datasetId, setDatasetId] = useState<Dataset["id"]>("population");
  const dataset = useMemo(() => (datasets.find((d) => d.id === datasetId) ?? datasets[0]!).load(), [datasets, datasetId]);

  const data = dataset.data;
  const [layout, setLayout] = useState<"grid" | "states">("grid");
  const [resolution, setResolution] = useState(7);
  const [adaptive, setAdaptive] = useState(true);
  const [paletteOverride, setPaletteOverride] = useState<PaletteName | null>(null);
  const [scaleType, setScaleType] = useState<"sequential" | "quantize">("sequential");
  const [gap, setGap] = useState(0.05);
  const [outlines, setOutlines] = useState(false);
  const [entrance, setEntrance] = useState<"ripple" | "sweep" | "fade">("ripple");
  const [replay, setReplay] = useState(0);
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [selected, setSelected] = useState<TileWithData | null>(null);

  const palette = paletteOverride ?? dataset.palette;
  const colorScale = useMemo(
    () =>
      scaleType === "sequential"
        ? ({ type: "sequential", palette, transform: dataset.transform } as const)
        : ({ type: "quantize", palette, steps: 6 } as const),
    [scaleType, palette, dataset.transform],
  );

  const tileCount = useMemo(
    () =>
      layout === "states"
        ? country.regions.length
        : buildHexGrid({ country, hexSize: resolutionToHexSize(resolution) }).tiles.length,
    [country, layout, resolution],
  );

  const resolutionCode =
    view === "3d"
      ? `\n  resolution={${resolution}}`
      : `\n  resolution={${adaptive ? `"auto"` : resolution}}${adaptive ? `\n  autoResolution={{ base: ${resolution} }}` : ""}`;
  const { constName } = COUNTRIES[countryId];
  const imports =
    view === "3d"
      ? `import { ${constName} } from "hexamap-tiles";\nimport { HexMap3D } from "hexamap-tiles/3d";`
      : `import { HexMap, ${constName} } from "hexamap-tiles";`;
  const code = `${imports}\n\n<${view === "3d" ? "HexMap3D" : "HexMap"}
  country={${constName}}
  layout="${layout}"${layout === "grid" ? resolutionCode : ""}
  data={${dataset.id}}
  aggregate="${dataset.aggregate}"
  colorScale={{ type: "${scaleType}", palette: "${palette}"${scaleType === "quantize" ? ", steps: 6" : dataset.transform ? `, transform: "${dataset.transform}"` : ""} }}
  tileGap={${gap}}${layout === "grid" && outlines ? "\n  showStateBorders\n  showOutline" : ""}
  entrance="${entrance}"
  legend={{ title: "${dataset.legendTitle}" }}
  onTileClick={(tile) => console.log(tile.data)}
/>`;

  return (
    <section id="playground" className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Map card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1], delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_32px_-12px_rgba(0,0,0,0.08)] dark:border-stone-800 dark:bg-stone-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-3 dark:border-stone-800">
            <div className="min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={dataset.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="text-sm font-semibold">{dataset.label}</div>
                  <div className="truncate text-xs text-stone-500 dark:text-stone-400">{dataset.blurb}</div>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] text-stone-500 tabular-nums dark:text-stone-400">
              <span>{tileCount.toLocaleString("en-US")} tiles</span>
              <span className="h-3 w-px bg-stone-200 dark:bg-stone-700" />
              <span>{data.length.toLocaleString("en-US")} records</span>
            </div>
          </div>

          <div className="p-2 sm:p-4">
            <div
              className="mx-auto"
              style={{ maxWidth: view === "3d" ? undefined : MAX_MAP_HEIGHT * (country.geometry.width / country.geometry.height) }}
            >
            {view === "3d" ? (
              <HexMap3D
                country={country}
                key={replay}
                entrance={entrance}
                layout={layout}
                resolution={resolution}
                data={data}
                aggregate={dataset.aggregate}
                colorScale={colorScale}
                tileGap={gap}
                showStateBorders={outlines}
                showOutline={outlines}
                valueLabel={dataset.valueLabel}
                legend={{ title: dataset.legendTitle }}
                theme={dark ? "dark" : "light"}
                selectedTileId={selected?.id ?? null}
                onTileClick={(t) => setSelected((s) => (s?.id === t.id ? null : t))}
              />
            ) : (
            <HexMap<HexDatum>
              key={replay}
              country={country}
              entrance={entrance}
              layout={layout}
              resolution={adaptive ? "auto" : resolution}
              autoResolution={{ base: resolution }}
              data={data}
              aggregate={dataset.aggregate}
              colorScale={colorScale}
              tileGap={gap}
              showStateBorders={outlines}
              showOutline={outlines}
              valueLabel={dataset.valueLabel}
              legend={{ title: dataset.legendTitle }}
              theme={dark ? "dark" : "light"}
              selectedTileId={selected?.id ?? null}
              onTileClick={(t) => setSelected((s) => (s?.id === t.id ? null : t))}
            />
            )}
            </div>
          </div>

          <AnimatePresence>
            {selected && <SelectedPanel key="sel" tile={selected} dataset={dataset} noun={country.regionNoun} onClose={() => setSelected(null)} />}
          </AnimatePresence>
        </motion.div>

        {/* Controls */}
        <motion.aside
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1], delay: 0.2 }}
          className="space-y-5 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
        >
          <Field label="Country">
            <Segmented
              size="sm"
              value={countryId}
              onChange={(v) => {
                setCountryId(v);
                setSelected(null);
              }}
              options={(Object.keys(COUNTRIES) as CountryId[]).map((id) => ({ value: id, label: COUNTRIES[id].label }))}
            />
          </Field>

          <Field label="Dataset">
            <div className="grid gap-1.5">
              {datasets.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setDatasetId(d.id);
                    setPaletteOverride(null);
                    setSelected(null);
                  }}
                  className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                    d.id === datasetId
                      ? "text-stone-900 dark:text-stone-50"
                      : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                  }`}
                >
                  {d.id === datasetId && (
                    <motion.span
                      layoutId="dataset-active"
                      className="absolute inset-0 rounded-lg bg-stone-100 dark:bg-stone-800"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span
                    className="relative h-3 w-3 shrink-0 rounded-[3px]"
                    style={{ background: `linear-gradient(135deg, ${PALETTES[d.palette].slice(1).join(",")})` }}
                  />
                  <span className="relative font-medium">{d.label}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="View">
            <Segmented
              value={view}
              onChange={(v) => {
                setView(v);
                setSelected(null);
              }}
              options={[
                { value: "2d", label: "2D" },
                { value: "3d", label: "3D · height = value" },
              ]}
            />
          </Field>

          <Field label="Layout">
            <Segmented
              value={layout}
              onChange={(v) => {
                setLayout(v);
                setSelected(null);
              }}
              options={[
                { value: "grid", label: "Hex grid" },
                { value: "states", label: country.regionNoun === "Province" ? "Province tiles" : "State tiles" },
              ]}
            />
          </Field>

          <motion.div
            animate={{ opacity: layout === "grid" ? 1 : 0.4 }}
            className={`space-y-5 ${layout === "grid" ? "" : "pointer-events-none"}`}
          >
            <Field label="Resolution" hint={`${resolution} / 10`}>
              <Slider value={resolution} min={1} max={10} onChange={(v) => { setResolution(v); setSelected(null); }} />
            </Field>
            <div className="-mt-2 space-y-0.5">
              {view === "2d" && <Toggle checked={adaptive} onChange={setAdaptive} label="Refine detail on zoom" />}
              <Toggle checked={outlines} onChange={setOutlines} label="Outlines" />
            </div>
          </motion.div>

          <Field label="Tile gap" hint={gap.toFixed(2)}>
            <Slider value={gap} min={0} max={0.35} step={0.01} onChange={setGap} />
          </Field>

          <Field
            label="Entrance"
            hint={
              <button
                type="button"
                onClick={() => setReplay((n) => n + 1)}
                className="font-sans text-xs font-medium text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
              >
                ↻ Replay
              </button>
            }
          >
            <Segmented
              size="sm"
              value={entrance}
              onChange={(v) => {
                setEntrance(v);
                setReplay((n) => n + 1);
              }}
              options={[
                { value: "ripple", label: "Ripple" },
                { value: "sweep", label: "Sweep" },
                { value: "fade", label: "Fade" },
              ]}
            />
          </Field>

          <Field label="Scale">
            <Segmented
              size="sm"
              value={scaleType}
              onChange={setScaleType}
              options={[
                { value: "sequential", label: "Continuous" },
                { value: "quantize", label: "Stepped" },
              ]}
            />
          </Field>

          <Field label="Palette">
            <div className="grid grid-cols-7 gap-1.5">
              {PALETTE_OPTIONS.map((p) => (
                <motion.button
                  key={p}
                  type="button"
                  title={p}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setPaletteOverride(p)}
                  className={`h-7 rounded-md ring-offset-2 ring-offset-white transition-shadow dark:ring-offset-stone-900 ${
                    p === palette ? "ring-2 ring-stone-900 dark:ring-stone-100" : "ring-1 ring-stone-900/10 dark:ring-white/10"
                  }`}
                  style={{ background: `linear-gradient(to top, ${PALETTES[p].join(",")})` }}
                />
              ))}
            </div>
          </Field>

          <p className="border-t border-stone-100 pt-4 text-xs leading-relaxed text-stone-500 dark:border-stone-800 dark:text-stone-400">
            Drag to pan · pinch or <kbd className="rounded border border-stone-200 px-1 font-mono text-[10px] dark:border-stone-700">⌘</kbd> + scroll to zoom · double-click to zoom in · click a tile to inspect it.
          </p>
        </motion.aside>
      </div>

      {/* Code */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-stone-900 dark:border-stone-800 dark:bg-stone-900/60"
      >
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
          <span className="font-mono text-xs text-stone-400">Playground.tsx</span>
          <CopyButton text={code} className="text-stone-400! hover:bg-white/10! hover:text-white!" />
        </div>
        <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-6 text-stone-300">
          <code>{code}</code>
        </pre>
      </motion.div>
    </section>
  );
}

function SelectedPanel({ tile, dataset, noun, onClose }: { tile: TileWithData; dataset: Dataset; noun: string; onClose: () => void }) {
  const top = useMemo(() => {
    const items = (tile.data?.items ?? []) as Array<{ city?: string; value?: number }>;
    const m = new Map<string, number>();
    for (const it of items) if (it.city) m.set(it.city, (m.get(it.city) ?? 0) + (dataset.aggregate === "count" ? 1 : (it.value ?? 0)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [tile, dataset.aggregate]);
  const max = top[0]?.[1] ?? 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className="absolute top-16 left-4 z-10 w-60 rounded-xl border border-stone-200 bg-white/90 p-3 shadow-xl backdrop-blur-md sm:top-20 sm:left-6 dark:border-stone-700 dark:bg-stone-900/90"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-stone-400 uppercase">
            {tile.id.includes(",") ? `Tile ${tile.id}` : noun}
          </div>
          <div className="text-sm font-semibold">{tile.state.name}</div>
        </div>
        <button onClick={onClose} className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-stone-800 dark:hover:text-stone-100" aria-label="Close">
          <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.5"><path d="M2 2l8 8M10 2l-8 8" /></svg>
        </button>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums">{tile.data ? fmt.format(tile.data.value) : "—"}</span>
        <span className="text-xs text-stone-500">{dataset.valueLabel.toLowerCase()}</span>
      </div>
      {top.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {top.map(([city, v], i) => (
            <div key={city} className="text-xs">
              <div className="flex justify-between text-stone-600 dark:text-stone-300">
                <span className="truncate">{city}</span>
                <span className="tabular-nums">{fmt.format(v)}</span>
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                <motion.div
                  className="h-full rounded-full bg-stone-800 dark:bg-stone-200"
                  initial={{ width: 0 }}
                  animate={{ width: `${(v / max) * 100}%` }}
                  transition={{ delay: 0.05 * i, type: "spring", stiffness: 200, damping: 30 }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
