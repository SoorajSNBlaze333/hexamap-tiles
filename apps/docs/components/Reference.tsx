import { SectionHeading } from "./Examples";

export const REPO_URL = "https://github.com/SoorajSNBlaze333/hexamap-tiles";

const FORMATS = [
  {
    name: "Points",
    key: "lat / lng",
    body: "Raw events. Each is placed in the hex that contains it; records in the same tile are combined with `aggregate`.",
    code: `{ lat: 41.88, lng: -87.63, value: 3 }`,
  },
  {
    name: "Region values",
    key: "state",
    body: "Pre-aggregated numbers. Accepts a code, ISO / FIPS id or name. Every tile in the region inherits the value.",
    code: `{ state: "TX", value: 1240 }
{ state: "Maharashtra", value: 87 }
{ state: "AU-NSW", value: 18.2 }`,
  },
  {
    name: "Exact tiles",
    key: "tileId",
    body: "Address a hex directly: \"q,r\" in the grid layout (from `onTileClick` or `buildHexGrid`), or the region code in the states layout.",
    code: `{ tileId: "34,-12", value: 9 }
{ tileId: "CA", value: 42 }`,
  },
];

const OPTIONS: Array<[prop: string, values: string]> = [
  ["aggregate", `"sum" · "mean" · "count" · "min" · "max" · (items, values) => number`],
  ["value", `(d) => number — defaults to d.value ?? 1`],
  ["colorScale", `{ type: "sequential", palette, transform: "linear" | "sqrt" | "log", domain? }
{ type: "quantize", palette, steps }
{ type: "threshold", thresholds: number[], colors: string[] }`],
  ["palette", `"blues" · "teal" · "purples" · "heat" · "viridis" · "magma" · "plasma" · "redBlue" · string[]`],
  ["format", `(v) => string — numbers in the legend and tooltip`],
  ["country", `USA (default) · INDIA · CHINA · AUSTRALIA`],
  ["layout", `"grid" (default) · "states" (one hex per region)`],
  ["resolution", `1–10 (default 7) · "auto" adds detail as you zoom`],
];

const ROADMAP = [
  { title: "Timeline playback", body: "Records with a timestamp and a scrubber that plays through hours or days." },
  { title: "Live data hook", body: "`useHexStream()` for websocket feeds: a rolling window with a steady color scale." },
  { title: "Compare mode", body: "Color tiles by change between two datasets, absolute or percent." },
  { title: "Per-capita values", body: "`normalize=\"population\"` so maps stop just showing where people live." },
  { title: "Hotspot detection", body: "Flag statistically unusual clusters (Getis-Ord Gi*) and outline them." },
  { title: "Selection & brushing", body: "Lasso or shift-click tiles and get the selection's totals for linked charts." },
  { title: "H3 grids", body: "Use Uber's H3 cells so tiles line up with data that's already H3-indexed." },
  { title: "WebGL renderer", body: "100k+ tiles and million-point datasets in 2D, with binning in a Web Worker." },
  { title: "Export & share", body: "PNG, SVG and video export, plus view state encoded in the URL." },
];

function inlineCode(text: string) {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith("`") ? (
      <code key={i} className="rounded bg-stone-100 px-1 py-px font-mono text-[12px] text-stone-800 dark:bg-stone-800 dark:text-stone-200">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

export function DataFormats() {
  return (
    <section id="data" className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
      <SectionHeading eyebrow="Data format" title="Three ways to describe where a record belongs">
        Records are plain objects. Each is placed by the first of these it has, and any other fields are kept on{" "}
        <code className="font-mono text-[12px]">tile.data.items</code> for tooltips and click handlers.
      </SectionHeading>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {FORMATS.map((f, i) => (
          <div key={f.name} className="flex flex-col rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{f.name}</div>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 font-mono text-[11px] text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                {i + 1}. {f.key}
              </span>
            </div>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-stone-600 dark:text-stone-400">{inlineCode(f.body)}</p>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-stone-900 p-3 font-mono text-[12px] leading-5 text-stone-300 dark:bg-stone-950">
              <code>{f.code}</code>
            </pre>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800">
        <table className="w-full text-left text-sm">
          <tbody>
            {OPTIONS.map(([prop, values]) => (
              <tr key={prop} className="border-b border-stone-100 last:border-0 dark:border-stone-800">
                <td className="w-36 bg-stone-50 px-4 py-2.5 align-top font-mono text-[13px] font-medium dark:bg-stone-900/60">{prop}</td>
                <td className="px-4 py-2.5 font-mono text-[12px] leading-5 whitespace-pre-wrap text-stone-600 dark:text-stone-400">{values}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Roadmap() {
  return (
    <section id="roadmap" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <SectionHeading eyebrow="Coming next" title="On the roadmap for v2">
        Planned features, roughly in order. Ideas and pull requests are welcome on{" "}
        <a href={`${REPO_URL}/issues`} className="underline underline-offset-2 hover:text-stone-900 dark:hover:text-stone-100">
          GitHub
        </a>
        .
      </SectionHeading>
      <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-stone-200 bg-stone-200 sm:grid-cols-2 lg:grid-cols-3 dark:border-stone-800 dark:bg-stone-800">
        {ROADMAP.map((r) => (
          <div key={r.title} className="bg-white p-5 dark:bg-stone-900">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">{r.title}</div>
              <span className="rounded-full border border-dashed border-stone-300 px-2 py-px text-[10px] font-medium tracking-wide text-stone-500 uppercase dark:border-stone-700 dark:text-stone-400">
                Planned
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-600 dark:text-stone-400">{inlineCode(r.body)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function GitHubIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
