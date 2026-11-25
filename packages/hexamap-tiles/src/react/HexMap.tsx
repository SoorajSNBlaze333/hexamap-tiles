import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { bindData, type BoundData } from "../core/bind";
import { luminance } from "../core/color";
import { buildHexGrid, buildStatesLayout, resolutionToHexSize, tileAtPoint, type Bounds } from "../core/grid";
import { hexCorners, hexPath } from "../core/hex";
import { createColorScale, type ColorScale, type ColorScaleConfig } from "../core/scale";
import { countryOutlinePath, regionBordersPath } from "../core/regions";
import { USA } from "../countries/us";
import type { Aggregate, HexDatum, HexLayout, LayoutType, TileStyle, TileWithData } from "../types";
import { REVEAL_DURATION, REVEAL_TOTAL_MS, revealDelay, type Entrance } from "../core/reveal";
import { HexMapLegend, defaultFormat } from "./Legend";
import { DefaultTooltipContent, TooltipOverlay } from "./Tooltip";
import { cssVar, useResolvedTheme, type HexMapTheme, type ThemeOption } from "./theme";
import { usePanZoom } from "./usePanZoom";
import type { Corner, HexMapProps } from "./props";

export type { HexMapProps, HexMapBaseProps, TileStyleContext } from "./props";

type RevealPhase = "pending" | "running" | "done";

const CSS = `
.hm-tile{transition:fill .45s ease,opacity .3s ease}
@keyframes hm-pop{0%{opacity:0;transform:scale(0)}60%{opacity:1}100%{opacity:1;transform:scale(1)}}
@keyframes hm-fade{from{opacity:0}to{opacity:1}}
[data-hm-reveal=pending] .hm-tile,[data-hm-reveal=pending] .hm-label{opacity:0}
[data-hm-reveal=running] .hm-tile,[data-hm-reveal=running] .hm-label{animation:hm-pop ${REVEAL_DURATION}s cubic-bezier(.34,1.4,.64,1) both;animation-delay:var(--hm-delay,0s);transform-box:fill-box;transform-origin:center}
[data-hm-reveal=running][data-hm-entrance=fade] .hm-tile,[data-hm-reveal=running][data-hm-entrance=fade] .hm-label{animation-name:hm-fade;animation-timing-function:ease-out}
@media (prefers-reduced-motion:reduce){.hm-tile,.hm-label{animation:none!important;transition:none!important;opacity:1!important}}
`;

interface TilesLayerProps {
  layout: HexLayout;
  bound: BoundData<any>;
  scale: ColorScale;
  theme: HexMapTheme;
  gap: number;
  labels: boolean;
  getTileStyle?: HexMapProps<any>["getTileStyle"];
  entrance: Entrance;
}

const TilesLayer = memo(function TilesLayer({ layout, bound, scale, theme, gap, labels, getTileStyle, entrance }: TilesLayerProps) {
  const corners = useMemo(() => hexCorners(layout.size * (1 - gap)), [layout.size, gap]);
  const empty = cssVar(theme, "empty");
  const stroke = cssVar(theme, "stroke");
  return (
    <>
      {layout.tiles.map((tile) => {
        const data = bound.get(tile.id, tile.state.code);
        const base: TileStyle = {
          fill: data ? scale.color(data.value) : empty,
          stroke,
          strokeWidth: 0,
          opacity: 1,
          height: data?.value ?? 0,
        };
        const s = getTileStyle
          ? { ...base, ...getTileStyle({ ...tile, data }, { scale, defaultStyle: base, hovered: false }) }
          : base;
        const delay = `${revealDelay(entrance, tile.x, tile.y, tile.q, tile.r).toFixed(3)}s`;
        return (
          <g key={tile.id} style={{ ["--hm-delay" as string]: delay }}>
            <path
              className="hm-tile"
              d={hexPath(tile.x, tile.y, corners)}
              style={{ fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth, opacity: s.opacity }}
              vectorEffect="non-scaling-stroke"
            />
            {labels && (
              <text
                className="hm-label"
                x={tile.x}
                y={tile.y}
                dy="0.35em"
                textAnchor="middle"
                style={{
                  fontSize: layout.size * 0.48,
                  fontWeight: 600,
                  pointerEvents: "none",
                  fill: s.fill.startsWith("#")
                    ? luminance(s.fill) > 0.35
                      ? cssVar(theme, "labelDark")
                      : cssVar(theme, "labelLight")
                    : cssVar(theme, "muted"),
                  transition: "fill .45s ease",
                }}
              >
                {tile.state.code}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
});

export function HexMap<T extends HexDatum = HexDatum>(props: HexMapProps<T>) {
  const {
    country = USA,
    layout: layoutType = "grid",
    resolution = 7,
    autoResolution,
    hexSize,
    tileGap = 0.05,
    data,
    value,
    aggregate,
    colorScale,
    getTileStyle,
    showStateBorders = false,
    showOutline = false,
    showLabels = layoutType === "states",
    tooltip = true,
    legend,
    format = defaultFormat,
    valueLabel = "Value",
    zoom = true,
    maxZoom = 12,
    wheelZoom = "modifier",
    controls = zoom,
    selectedTileId,
    onTileClick,
    onTileHover,
    theme: themeOption,
    animate = true,
    entrance = "ripple",
    className,
    style,
  } = props;

  const theme = useResolvedTheme(themeOption);
  const v = (k: keyof HexMapTheme) => cssVar(theme, k);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);

  // Compact overlays on narrow containers.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setCompact((e?.contentRect.width ?? 1000) < 520));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const showHint = useCallback(() => {
    const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
    setHint(`Hold ${mac ? "⌘" : "Ctrl"} and scroll to zoom`);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 1400);
  }, []);
  useEffect(() => () => clearTimeout(hintTimer.current), []);

  const { width: MAP_WIDTH, height: MAP_HEIGHT } = country.geometry;
  const pz = usePanZoom(svgRef, { width: MAP_WIDTH, height: MAP_HEIGHT, enabled: zoom, minZoom: 1, maxZoom, wheel: wheelZoom, onWheelBlocked: showHint });

  // Apply the pan/zoom transform directly to the DOM every frame (no React render).
  useEffect(() => {
    const apply = () =>
      gRef.current?.setAttribute("transform", `translate(${pz.x.get()},${pz.y.get()}) scale(${pz.k.get()})`);
    apply();
    const subs = [pz.k.on("change", apply), pz.x.on("change", apply), pz.y.on("change", apply)];
    return () => subs.forEach((u) => u());
  }, [pz.k, pz.x, pz.y]);

  // A different layout is a different map: start from the full view.
  const firstLayout = useRef(true);
  useEffect(() => {
    if (firstLayout.current) {
      firstLayout.current = false;
      return;
    }
    pz.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutType, country]);

  // ----- Layout -----
  const isAuto = resolution === "auto";
  const baseSize = hexSize ?? resolutionToHexSize(isAuto ? (autoResolution?.base ?? 7) : resolution);
  const minHexSize = autoResolution?.minHexSize ?? 0.8;
  const { k: vk, x: vx, y: vy } = pz.view;
  const level = isAuto ? Math.max(0, Math.round(Math.log2(vk) * 2) / 2) : 0;
  const size = Math.max(minHexSize, baseSize / Math.pow(2, level));

  let bounds: Bounds | undefined;
  if (isAuto && layoutType === "grid" && vk > 1.01) {
    const snap = 40;
    const mx = MAP_WIDTH / vk / 8;
    const my = MAP_HEIGHT / vk / 8;
    bounds = [
      Math.floor((-vx / vk - mx) / snap) * snap,
      Math.floor((-vy / vk - my) / snap) * snap,
      Math.ceil(((MAP_WIDTH - vx) / vk + mx) / snap) * snap,
      Math.ceil(((MAP_HEIGHT - vy) / vk + my) / snap) * snap,
    ];
  }
  const boundsKey = bounds?.join(",") ?? "all";

  const layout = useMemo(
    () => (layoutType === "states" ? buildStatesLayout(country) : buildHexGrid({ country, hexSize: size, bounds })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [country, layoutType, size, boundsKey],
  );

  // ----- Data & scale -----
  const bound = useMemo(
    () => bindData(layout, data ?? [], { value, aggregate }),
    // Binding depends on the grid geometry, not on which tiles are currently built.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout.type, layout.country, layout.size, layout.origin, data, value, aggregate],
  );
  const scaleKey = JSON.stringify(colorScale ?? null);
  const scale = useMemo(
    () => createColorScale(colorScale ?? { type: "sequential" }, bound.values()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scaleKey, bound],
  );

  // ----- Entrance sweep -----
  // Tiles start hidden ("pending"), stagger in once the map is on screen ("running"),
  // then the animation is removed ("done") so zoom-driven tile swaps don't re-animate.
  // Changing layout or base resolution replays it.
  const revealEnabled = animate && entrance !== "none";
  const revealKey = `${country.id}|${layoutType}|${baseSize}`;
  const [reveal, setReveal] = useState<{ key: string; phase: RevealPhase }>(() => ({
    key: revealKey,
    phase: revealEnabled ? "pending" : "done",
  }));
  const revealPhase: RevealPhase = !revealEnabled ? "done" : reveal.key === revealKey ? reveal.phase : "running";

  // First appearance: wait until the map is actually visible.
  useEffect(() => {
    if (reveal.phase !== "pending") return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setReveal((r) => ({ ...r, phase: "running" }));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setReveal((r) => (r.phase === "pending" ? { ...r, phase: "running" } : r));
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reveal.phase]);

  // Layout / resolution change after the first reveal: replay immediately.
  useEffect(() => {
    setReveal((r) => (r.key === revealKey ? r : { key: revealKey, phase: r.phase === "pending" ? "pending" : "running" }));
  }, [revealKey]);

  useEffect(() => {
    if (revealPhase !== "running") return;
    const t = setTimeout(() => setReveal((r) => (r.key === revealKey ? { ...r, phase: "done" } : r)), REVEAL_TOTAL_MS);
    return () => clearTimeout(t);
  }, [revealPhase, revealKey]);

  // ----- Hover & tooltip -----
  const [hover, setHover] = useState<{ tile: TileWithData<T>; flip: boolean } | null>(null);
  const tipX = useMotionValue(0);
  const tipY = useMotionValue(0);
  const springX = useSpring(tipX, { stiffness: 600, damping: 45 });
  const springY = useSpring(tipY, { stiffness: 600, damping: 45 });
  const hoverId = hover?.tile.id;

  const withData = useCallback(
    (tile: HexLayout["tiles"][number]): TileWithData<T> => ({ ...tile, data: bound.get(tile.id, tile.state.code) }),
    [bound],
  );

  // Drop hover when the layout changes underneath it.
  useEffect(() => {
    if (hoverId && !layout.byId.has(hoverId)) setHover(null);
  }, [layout, hoverId]);

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.buttons && pz.wasDragged()) {
      if (hover) setHover(null);
      return;
    }
    const p = pz.toMap(e.clientX, e.clientY);
    const tile = p ? tileAtPoint(layout, p[0], p[1]) : undefined;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const first = !hover;
      tipX.set(e.clientX - rect.left);
      tipY.set(e.clientY - rect.top);
      if (first) {
        springX.jump(tipX.get());
        springY.jump(tipY.get());
      }
    }
    if (tile?.id !== hoverId) {
      const next = tile ? { tile: withData(tile), flip: !!rect && e.clientX - rect.left > rect.width - 220 } : null;
      setHover(next);
      onTileHover?.(next?.tile ?? null);
    } else if (hover && rect) {
      const flip = e.clientX - rect.left > rect.width - 220;
      if (flip !== hover.flip) setHover({ ...hover, flip });
    }
  };
  const onPointerLeave = () => {
    if (hover) onTileHover?.(null);
    setHover(null);
  };
  const onClick = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (!onTileClick || pz.wasDragged()) return;
    const p = pz.toMap(e.clientX, e.clientY);
    const tile = p ? tileAtPoint(layout, p[0], p[1]) : undefined;
    if (tile) onTileClick(withData(tile), e);
  };

  const outlineD = useMemo(() => hexPath(0, 0, hexCorners(layout.size * (1 - tileGap))), [layout.size, tileGap]);
  const selected = selectedTileId ? layout.byId.get(selectedTileId) : undefined;
  const hoverTransition = animate ? { type: "spring", stiffness: 700, damping: 45 } as const : { duration: 0 };

  const legendCfg = legend === undefined ? (data?.length ? {} : false) : legend === true ? {} : legend;
  const legendPos: Corner | "below" = (legendCfg && legendCfg.position) || "below";
  const corner = (c: Corner): CSSProperties => ({
    position: "absolute",
    [c.startsWith("top") ? "top" : "bottom"]: compact ? 6 : 12,
    [c.endsWith("left") ? "left" : "right"]: compact ? 6 : 12,
  });

  const button: CSSProperties = {
    width: compact ? 24 : 30,
    height: compact ? 24 : 30,
    display: "grid",
    placeItems: "center",
    background: "transparent",
    border: "none",
    color: v("text"),
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
  };

  return (
    <div
      ref={containerRef}
      className={className}
      data-hexmap=""
      style={{ position: "relative", width: "100%", fontFamily: "inherit", ...style }}
    >
      <style>{CSS}</style>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        role="img"
        aria-label={props["aria-label"] ?? `Hexagonal map of ${country.name}`}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onClick={onClick}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}`,
          touchAction: zoom ? "none" : "auto",
          cursor: hover && onTileClick ? "pointer" : zoom ? "grab" : "default",
          userSelect: "none",
          overflow: "hidden",
        }}
      >
        <g ref={gRef}>
          <AnimatePresence initial={false}>
            <motion.g
              key={`${country.id}-${layoutType}-${layout.size}`}
              initial={animate ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              data-hm-reveal={revealPhase === "done" ? undefined : revealPhase}
              data-hm-entrance={entrance}
            >
              <TilesLayer
                layout={layout}
                bound={bound}
                scale={scale}
                theme={theme}
                gap={tileGap}
                labels={showLabels}
                getTileStyle={getTileStyle}
                entrance={entrance}
              />
            </motion.g>
          </AnimatePresence>
          {showStateBorders && layoutType === "grid" && (
            <path
              d={regionBordersPath(country)}
              fill="none"
              style={{ stroke: v("border"), strokeWidth: 0.75, strokeLinejoin: "round", pointerEvents: "none" }}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {showOutline && layoutType === "grid" && (
            <path
              d={countryOutlinePath(country)}
              fill="none"
              style={{ stroke: v("outline"), strokeWidth: 1.25, strokeLinejoin: "round", pointerEvents: "none" }}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {selected && (
            <motion.path
              d={outlineD}
              initial={false}
              animate={{ x: selected.x, y: selected.y }}
              transition={hoverTransition}
              fill="none"
              style={{ stroke: v("highlight"), strokeWidth: 2.5, pointerEvents: "none" }}
              vectorEffect="non-scaling-stroke"
            />
          )}
          <AnimatePresence>
            {hover && (
              <motion.path
                key="hover"
                d={outlineD}
                initial={{ opacity: 0, x: hover.tile.x, y: hover.tile.y }}
                animate={{ opacity: 1, x: hover.tile.x, y: hover.tile.y }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={hoverTransition}
                fill="none"
                style={{ stroke: v("highlight"), strokeWidth: 1.5, pointerEvents: "none" }}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </AnimatePresence>
        </g>
      </svg>

      {legendCfg && legendPos === "below" && (
        <div data-hexmap-legend-row="" style={{ display: "flex", justifyContent: "flex-end", marginTop: compact ? 6 : 10 }}>
          <HexMapLegend scale={scale} title={legendCfg.title} format={legendCfg.format ?? format} theme={theme} compact={compact} />
        </div>
      )}

      <TooltipOverlay open={!!hover && tooltip !== false} x={springX} y={springY} flip={!!hover?.flip} theme={theme}>
        {hover &&
          (typeof tooltip === "function" ? (
            tooltip(hover.tile)
          ) : (
            <DefaultTooltipContent tile={hover.tile} theme={theme} valueLabel={valueLabel} format={format} />
          ))}
      </TooltipOverlay>

      {legendCfg && legendPos !== "below" && (
        <HexMapLegend
          scale={scale}
          title={legendCfg.title}
          format={legendCfg.format ?? format}
          theme={theme}
          compact={compact}
          style={{ ...corner(legendPos), zIndex: 1 }}
        />
      )}

      {controls && zoom && (
        <div
          data-hexmap-controls=""
          style={{
            ...corner(legendPos === "top-right" ? "top-left" : "top-right"),
            display: "flex",
            flexDirection: "column",
            borderRadius: 10,
            overflow: "hidden",
            background: v("surface"),
            border: `1px solid ${v("surfaceBorder")}`,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 1,
          }}
        >
          <motion.button type="button" aria-label="Zoom in" whileTap={{ scale: 0.9 }} style={button} onClick={() => pz.zoomBy(1.6)}>
            +
          </motion.button>
          <motion.button type="button" aria-label="Zoom out" whileTap={{ scale: 0.9 }} style={button} onClick={() => pz.zoomBy(1 / 1.6)}>
            −
          </motion.button>
          <motion.button type="button" aria-label="Reset view" whileTap={{ scale: 0.9 }} style={{ ...button, fontSize: 13 }} onClick={() => pz.reset()}>
            ⤢
          </motion.button>
        </div>
      )}

      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              translateX: "-50%",
              translateY: "-50%",
              padding: "8px 12px",
              borderRadius: 999,
              fontSize: 12,
              background: v("surface"),
              border: `1px solid ${v("surfaceBorder")}`,
              color: v("text"),
              pointerEvents: "none",
              zIndex: 3,
            }}
          >
            {hint}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
