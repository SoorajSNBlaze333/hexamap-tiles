export { HexMap } from "./react/HexMap";
export type { HexMapProps, HexMapBaseProps, TileStyleContext, Corner } from "./react/props";
export type { Entrance } from "./core/reveal";
export { HexMapLegend, defaultFormat } from "./react/Legend";
export type { HexMapLegendProps } from "./react/Legend";
export { LIGHT_THEME, DARK_THEME } from "./react/theme";
export type { HexMapTheme, ThemeOption } from "./react/theme";

export { buildHexGrid, buildStatesLayout, resolutionToHexSize, tileAtPoint, MIN_RESOLUTION, MAX_RESOLUTION } from "./core/grid";
export type { GridOptions, Bounds } from "./core/grid";
export { bindData } from "./core/bind";
export type { BindOptions, BoundData } from "./core/bind";
export { createColorScale } from "./core/scale";
export type { ColorScale, ColorScaleConfig, LegendStop } from "./core/scale";
export { PALETTES, interpolateColors } from "./core/color";
export type { PaletteName } from "./core/color";
export { projectLngLat, unprojectPoint, countryProjection, MAP_WIDTH, MAP_HEIGHT } from "./core/projection";
export {
  regionAtPoint,
  regionIdAtPoint,
  regionById,
  resolveRegion,
  regionLabelPoints,
  regionBordersPath,
  countryOutlinePath,
  stateAtPoint,
  resolveState,
} from "./core/regions";
export { hexToPixel, pixelToHex, hexCorners, hexPath } from "./core/hex";
export { USA, US_STATES, INDIA, CHINA, AUSTRALIA } from "./countries";
export { defineCountry, decodeGeometry } from "./countries";
export type { Country, CountryGeometry, EncodedCountryGeometry, RegionInfo } from "./countries";
/** @deprecated Use {@link RegionInfo}. */
export type { RegionInfo as StateInfo } from "./countries";

export type {
  LayoutType,
  HexTile,
  HexLayout,
  HexDatum,
  Aggregate,
  AggregateFn,
  TileData,
  TileWithData,
  TileStyle,
} from "./types";
