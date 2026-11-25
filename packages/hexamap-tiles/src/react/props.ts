import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import type { Entrance } from "../core/reveal";
import type { ColorScale, ColorScaleConfig } from "../core/scale";
import type { Aggregate, HexDatum, LayoutType, TileStyle, TileWithData } from "../types";
import type { ThemeOption } from "./theme";
import type { Country } from "../countries/types";

export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface TileStyleContext {
  scale: ColorScale;
  defaultStyle: TileStyle;
  hovered: boolean;
}

/** Props shared by the 2D `HexMap` and the 3D `HexMap3D`. */
export interface HexMapBaseProps<T extends HexDatum = HexDatum> {
  /**
   * Which country to draw: `USA` (default), `INDIA`, `CHINA`, `AUSTRALIA`, or your own
   * {@link Country}. Import the ones you use so the others are tree-shaken away.
   */
  country?: Country;
  /** "grid": the country tessellated into hexes. "states": one hex per state/province. Default "grid". */
  layout?: LayoutType;
  /** Exact hex radius in map units (overrides `resolution`). */
  hexSize?: number;
  /** Gap between tiles as a fraction of the hex radius. Default 0.05. */
  tileGap?: number;

  data?: readonly T[];
  /** Numeric value of a record. Default `d.value ?? 1`. */
  value?: (d: T) => number;
  /** How records sharing a tile are combined. Default "sum". */
  aggregate?: Aggregate<T>;
  colorScale?: ColorScaleConfig;
  /**
   * Per-tile style override. Runs after the color scale. In 3D, `height` is the
   * column height in map units (the map is 975 units wide).
   */
  getTileStyle?: (tile: TileWithData<T>, ctx: TileStyleContext) => Partial<TileStyle> | undefined;

  /** Thin lines between states/provinces (grid layout). Default false. */
  showStateBorders?: boolean;
  /** Draw the country's true coastline/border (grid layout). Default false. */
  showOutline?: boolean;

  tooltip?: boolean | ((tile: TileWithData<T>) => ReactNode);
  /**
   * Color legend. `position` is "below" (default: under the map, so it never covers tiles) or a
   * corner to float it over the map.
   */
  legend?: boolean | { title?: string; position?: Corner | "below"; format?: (v: number) => string };
  /** Formats values in the default tooltip and legend. */
  format?: (v: number) => string;
  /** Label for values in the default tooltip. Default "Value". */
  valueLabel?: string;

  selectedTileId?: string | null;
  onTileHover?: (tile: TileWithData<T> | null) => void;

  theme?: ThemeOption;
  /** Entrance & transition animations. Default true (always off with prefers-reduced-motion). */
  animate?: boolean;
  /**
   * How tiles stagger in when the map first scrolls into view (and when the layout or
   * resolution changes). "ripple" grows outward from the center, "sweep" goes west → east,
   * "fade" fades tiles in at random. Default "ripple".
   */
  entrance?: Entrance;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

export interface HexMapProps<T extends HexDatum = HexDatum> extends HexMapBaseProps<T> {
  /**
   * Grid detail, 1 (coarse) – 10 (fine). "auto" starts at `autoResolution.base`
   * (default 7) and adds detail as you zoom in, building only the tiles in view. Default 7.
   */
  resolution?: number | "auto";
  autoResolution?: { base?: number; minHexSize?: number };
  /** Show region codes on tiles. Defaults to true for the states layout. */
  showLabels?: boolean;

  /** Enable pan & zoom. Default true. */
  zoom?: boolean;
  maxZoom?: number;
  /** "modifier" (default) needs ⌘/Ctrl or a trackpad pinch so page scrolling isn't hijacked. */
  wheelZoom?: "modifier" | "always" | "off";
  /** Show +/−/reset buttons. Default true when zoom is enabled. */
  controls?: boolean;

  onTileClick?: (tile: TileWithData<T>, event: ReactMouseEvent<SVGSVGElement>) => void;
}
