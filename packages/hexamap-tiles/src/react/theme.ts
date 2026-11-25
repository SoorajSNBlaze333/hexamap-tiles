import { useSyncExternalStore } from "react";

export interface HexMapTheme {
  /** Fill for tiles without data. */
  empty: string;
  /** Tile outline. */
  stroke: string;
  /** State borders overlay. */
  border: string;
  /** Country outline overlay. */
  outline: string;
  /** Hover/selection outline. */
  highlight: string;
  /** Text on tiles (states layout) when the fill is light. */
  labelDark: string;
  /** Text on tiles when the fill is dark. */
  labelLight: string;
  surface: string;
  surfaceBorder: string;
  text: string;
  muted: string;
}

export const LIGHT_THEME: HexMapTheme = {
  empty: "#e7e5e4",
  stroke: "#ffffff",
  border: "rgba(28,25,23,0.35)",
  outline: "rgba(28,25,23,0.6)",
  highlight: "#0c0a09",
  labelDark: "#1c1917",
  labelLight: "#fafaf9",
  surface: "rgba(255,255,255,0.86)",
  surfaceBorder: "rgba(28,25,23,0.08)",
  text: "#1c1917",
  muted: "#78716c",
};

export const DARK_THEME: HexMapTheme = {
  empty: "#292524",
  stroke: "#0c0a09",
  border: "rgba(250,250,249,0.3)",
  outline: "rgba(250,250,249,0.55)",
  highlight: "#fafaf9",
  labelDark: "#1c1917",
  labelLight: "#fafaf9",
  surface: "rgba(28,25,23,0.86)",
  surfaceBorder: "rgba(250,250,249,0.1)",
  text: "#fafaf9",
  muted: "#a8a29e",
};

export type ThemeOption = "light" | "dark" | "auto" | (Partial<HexMapTheme> & { base?: "light" | "dark" });

const query = "(prefers-color-scheme: dark)";
function subscribe(cb: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(query);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}
const getSnapshot = () => typeof window !== "undefined" && !!window.matchMedia?.(query).matches;

export function useResolvedTheme(option: ThemeOption = "light"): HexMapTheme {
  const prefersDark = useSyncExternalStore(subscribe, getSnapshot, () => false);
  if (option === "light") return LIGHT_THEME;
  if (option === "dark") return DARK_THEME;
  if (option === "auto") return prefersDark ? DARK_THEME : LIGHT_THEME;
  const { base, ...rest } = option;
  return { ...(base === "dark" ? DARK_THEME : LIGHT_THEME), ...rest };
}

/** Every theme color can be overridden from CSS via `--hm-<key>` custom properties. */
export const cssVar = (theme: HexMapTheme, key: keyof HexMapTheme) => `var(--hm-${key}, ${theme[key]})`;
