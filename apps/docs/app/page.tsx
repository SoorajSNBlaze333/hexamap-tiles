import { Examples } from "@/components/Examples";
import { Playground } from "@/components/Playground";
import { DataFormats, GitHubIcon, REPO_URL, Roadmap } from "@/components/Reference";
import { CopyButton, HexLogo, ThemeToggle } from "@/components/ui";

const VERSION = "1.0";

const FEATURES = [
  { title: "Any resolution", body: "From ~270 coarse hexes to 15k fine ones. Or let detail refine as you zoom, building only what's in view." },
  { title: "Bring any data", body: "Points by lat/lng, values by state or province, or exact tile ids. Sum, mean, count, min, max or your own aggregator." },
  { title: "2D and 3D", body: "The same props render a flat map or a tilted 3D view where each tile's height is its value." },
  { title: "Four countries", body: "USA, India, China and Australia, each scaled so a resolution gives the same tile count. Import only what you use." },
  { title: "Style every tile", body: "Built-in color scales in OKLab, or a getTileStyle callback for full control over each hex." },
  { title: "Smooth by default", body: "Spring-driven pan & zoom, animated hover, staggered entrances and color transitions — reduced-motion aware." },
  { title: "Small", body: "About 39 KB gzipped for the USA map. Map shapes are compressed and decoded on first use." },
  { title: "Headless core", body: "Grid building, point binning and color scales are plain functions you can use without React." },
];

const NAV = [
  ["#playground", "Playground"],
  ["#examples", "Examples"],
  ["#data", "Data format"],
  ["#roadmap", "Roadmap"],
] as const;

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-stone-50/80 backdrop-blur-md dark:border-stone-800/70 dark:bg-stone-950/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <HexLogo className="h-6 w-6 text-stone-900 dark:text-stone-100" />
            <span className="font-semibold tracking-tight">hexamap-tiles</span>
            <span className="rounded-full border border-stone-200 px-1.5 py-px font-mono text-[10px] text-stone-500 dark:border-stone-700 dark:text-stone-400">
              v{VERSION}
            </span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            {NAV.map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="hidden rounded-lg px-3 py-1.5 text-stone-600 hover:text-stone-900 md:block dark:text-stone-400 dark:hover:text-stone-100"
              >
                {label}
              </a>
            ))}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub repository"
              className="grid h-8 w-8 place-items-center rounded-lg text-stone-500 transition-colors hover:bg-stone-200/60 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            >
              <GitHubIcon className="h-4 w-4" />
            </a>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pt-14 pb-10 sm:px-6 sm:pt-20">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Hexagonal maps for analytics.
        </h1>
        <p className="mt-4 max-w-xl text-base text-pretty text-stone-600 sm:text-lg dark:text-stone-400">
          A React library that turns the USA, India, China or Australia into a grid of hex tiles — at any
          resolution, in 2D or 3D — and paints them with your data. Outages, incidents, coverage, anything with a
          place.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-3 rounded-xl border border-stone-200 bg-white py-1.5 pr-1.5 pl-4 font-mono text-sm dark:border-stone-800 dark:bg-stone-900">
            <span className="text-stone-400">$</span>
            <span>npm i hexamap-tiles framer-motion</span>
            <CopyButton text="npm i hexamap-tiles framer-motion" />
          </div>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
          >
            <GitHubIcon className="h-4 w-4" />
            View on GitHub
          </a>
        </div>
      </section>

      <Playground />

      <Examples />

      <DataFormats />

      <section id="features" className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-stone-200 bg-stone-200 sm:grid-cols-2 lg:grid-cols-4 dark:border-stone-800 dark:bg-stone-800">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white p-5 dark:bg-stone-900">
              <div className="text-sm font-semibold">{f.title}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600 dark:text-stone-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <Roadmap />

      <footer className="border-t border-stone-200 py-8 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-500">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
          <span>hexamap-tiles · MIT license</span>
          <span>
            Population figures are census data; all other demo datasets are modelled. Map data from us-atlas and
            Natural Earth.
          </span>
          <span className="flex items-center gap-4">
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-stone-900 dark:hover:text-stone-200">
              GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/hexamap-tiles"
              target="_blank"
              rel="noreferrer"
              className="hover:text-stone-900 dark:hover:text-stone-200"
            >
              npm
            </a>
            <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer" className="hover:text-stone-900 dark:hover:text-stone-200">
              Issues
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
