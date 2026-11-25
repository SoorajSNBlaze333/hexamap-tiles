import { MAP_HEIGHT, MAP_WIDTH } from "./projection";

export type Entrance = "ripple" | "sweep" | "fade" | "none";

/** Seconds over which tile start times are spread, and each tile's own duration. */
export const REVEAL_SPREAD = 0.9;
export const REVEAL_DURATION = 0.55;
export const REVEAL_TOTAL_MS = (REVEAL_SPREAD + 0.1 + REVEAL_DURATION) * 1000 + 100;

/** Deterministic 0–1 jitter per tile so the stagger feels organic but is stable across renders. */
const jitter = (q: number, r: number) => ((((q * 73856093) ^ (r * 19349663)) >>> 0) % 1000) / 1000;

/** Start delay (seconds) of a tile's entrance animation. */
export function revealDelay(entrance: Entrance, x: number, y: number, q: number, r: number): number {
  const j = jitter(q, r);
  if (entrance === "sweep") return (x / MAP_WIDTH) * REVEAL_SPREAD * 0.85 + (y / MAP_HEIGHT) * 0.12 + j * 0.06;
  if (entrance === "fade") return j * REVEAL_SPREAD;
  const d = Math.hypot(x - MAP_WIDTH / 2, y - MAP_HEIGHT / 2) / Math.hypot(MAP_WIDTH / 2, MAP_HEIGHT / 2);
  return d * REVEAL_SPREAD + j * 0.08;
}
