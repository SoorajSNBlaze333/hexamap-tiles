import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  Matrix4,
  MeshStandardMaterial,
  PerspectiveCamera,
  Spherical,
  Vector3,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { bindData, type BoundData } from "../core/bind";
import { buildHexGrid, buildStatesLayout, resolutionToHexSize } from "../core/grid";
import { revealDelay, type Entrance } from "../core/reveal";
import { createColorScale, extent, type ColorScale, type ColorScaleConfig } from "../core/scale";
import { USA } from "../countries/us";
import type { Country } from "../countries/types";
import type { HexDatum, HexLayout, HexTile, TileStyle, TileWithData } from "../types";
import { HexMapLegend, defaultFormat } from "../react/Legend";
import type { Corner, HexMapBaseProps } from "../react/props";
import { cssVar, useResolvedTheme, type HexMapTheme } from "../react/theme";
import { DefaultTooltipContent, TooltipOverlay } from "../react/Tooltip";

export interface HexMap3DProps<T extends HexDatum = HexDatum> extends HexMapBaseProps<T> {
  /** Grid detail, 1 (coarse) – 10 (fine). Default 7. */
  resolution?: number;
  /** Height of the tallest column, in map units (the map is 975 units wide). Default 110. */
  heightScale?: number;
  /** Height of tiles without data (and the floor of tiles with data). Default 1.5. */
  baseHeight?: number;
  /**
   * How values map to heights. Defaults to the color scale's transform for
   * sequential scales, otherwise "linear".
   */
  heightTransform?: "linear" | "sqrt" | "log";
  /** Camera tilt from straight-down, in degrees. Default 52. */
  tilt?: number;
  /** Camera rotation around the map, in degrees (0 = looking north). Default 0. */
  rotation?: number;
  /** Orbit / zoom / pan with the mouse or touch. Default true. */
  controls?: boolean;
  /** "modifier" (default) needs ⌘/Ctrl or a trackpad pinch to zoom so page scrolling isn't hijacked. */
  wheelZoom?: "modifier" | "always" | "off";
  /** Slowly spin the map. Default false. */
  autoRotate?: boolean;
  /** Cast shadows between columns. Default true. */
  shadows?: boolean;
  onTileClick?: (tile: TileWithData<T>, event: ReactMouseEvent | MouseEvent) => void;
}

// ---------- helpers ----------

const tmpColor = new Color();

/** Parse "#rrggbb", "rgb()/rgba()" or a CSS var fallback ("var(--x, #fff)") into color + alpha. */
function parseColor(input: string, fallback = "#888888"): { color: Color; alpha: number } {
  let s = input.trim();
  const varMatch = /^var\([^,]+,\s*(.+)\)$/.exec(s);
  if (varMatch) s = varMatch[1]!.trim();
  const rgba = /^rgba?\(([^)]+)\)$/.exec(s);
  if (rgba) {
    const [r, g, b, a] = rgba[1]!.split(",").map((p) => parseFloat(p));
    return { color: new Color((r ?? 0) / 255, (g ?? 0) / 255, (b ?? 0) / 255), alpha: a ?? 1 };
  }
  try {
    return { color: new Color(s.startsWith("#") || /^[a-z]+$/i.test(s) ? s : fallback), alpha: 1 };
  } catch {
    return { color: new Color(fallback), alpha: 1 };
  }
}

const toWorld = (x: number, y: number, c: Country): [number, number] => [x - c.geometry.width / 2, y - c.geometry.height / 2];

function heightFraction(transform: "linear" | "sqrt" | "log", domain: [number, number]) {
  const f =
    transform === "log"
      ? (v: number) => Math.log10(Math.max(v, 1e-9))
      : transform === "sqrt"
        ? (v: number) => Math.sqrt(Math.max(0, v))
        : (v: number) => v;
  const lo = f(transform === "log" ? Math.max(domain[0], 1e-9) : domain[0]);
  const span = f(domain[1]) - lo || 1;
  return (v: number) => Math.min(1, Math.max(0, (f(v) - lo) / span));
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ---------- columns ----------

interface ColumnTargets {
  heights: Float32Array;
  colors: Float32Array;
  delays: Float32Array;
}

interface ColumnsProps {
  layout: HexLayout;
  radius: number;
  targets: ColumnTargets;
  /** Clock time (s) at which the entrance started; null = not started yet. */
  revealStart: number | null;
  animate: boolean;
  shadows: boolean;
  onHover: (index: number | null, e?: ThreeEvent<PointerEvent>) => void;
  onClick: (index: number, e: ThreeEvent<MouseEvent>) => void;
}

function Columns({ layout, radius, targets, revealStart, animate, shadows, onHover, onClick }: ColumnsProps) {
  const count = layout.tiles.length;
  const meshRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => {
    // Cylinder with 6 segments = hex prism; its first corner points along +z, which is
    // "pointy-top" in map space. Shift so it grows up from the ground.
    const g = new CylinderGeometry(radius, radius, 1, 6, 1);
    g.translate(0, 0.5, 0);
    return g;
  }, [radius]);
  const material = useMemo(() => new MeshStandardMaterial({ roughness: 0.6, metalness: 0.05, flatShading: true }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // Current (animated) state.
  const state = useMemo(
    () => ({ heights: new Float32Array(count).fill(0.01), colors: new Float32Array(count * 3), first: true }),
    [count, layout],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (!mesh.instanceColor || mesh.instanceColor.count !== count) {
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(count * 3), 3);
    }
    if (state.first) {
      state.colors.set(targets.colors);
      state.first = false;
    }
  }, [count, state, targets]);

  const m = useMemo(() => new Matrix4(), []);
  const maxDelay = useMemo(() => targets.delays.reduce((a, b) => (b > a ? b : a), 0), [targets]);
  // Skip per-frame work once every column has reached its target.
  const settled = useRef(false);
  useEffect(() => {
    settled.current = false;
  }, [targets, revealStart, layout]);

  useFrame(({ clock }, dt) => {
    const mesh = meshRef.current;
    if (!mesh || !mesh.instanceColor || settled.current) return;
    const now = clock.elapsedTime;
    const k = animate ? 1 - Math.exp(-dt * 7) : 1;
    const kc = animate ? 1 - Math.exp(-dt * 10) : 1;
    let moving = false;
    const colorArr = mesh.instanceColor.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const tile = layout.tiles[i]!;
      const started = revealStart !== null && (!animate || now - revealStart >= targets.delays[i]!);
      const target = started ? targets.heights[i]! : 0.01;
      const h = state.heights[i]!;
      const nh = Math.abs(target - h) < 0.01 ? target : h + (target - h) * k;
      if (nh !== h) moving = true;
      state.heights[i] = nh;
      for (let c = 0; c < 3; c++) {
        const j = i * 3 + c;
        const cur = state.colors[j]!;
        const tgt = targets.colors[j]!;
        const nc = Math.abs(tgt - cur) < 0.002 ? tgt : cur + (tgt - cur) * kc;
        if (nc !== cur) moving = true;
        state.colors[j] = nc;
        colorArr[j] = nc;
      }
      const [wx, wz] = toWorld(tile.x, tile.y, layout.country);
      m.makeScale(1, Math.max(0.01, nh), 1);
      m.setPosition(wx, 0, wz);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    if (!moving && revealStart !== null && (!animate || now - revealStart > maxDelay)) settled.current = true;
  });

  return (
    <instancedMesh
      key={`${count}-${radius}`}
      ref={meshRef}
      args={[geometry, material, count]}
      castShadow={shadows}
      receiveShadow={shadows}
      onPointerMove={(e) => {
        e.stopPropagation();
        onHover(e.instanceId ?? null, e);
      }}
      onPointerOut={() => onHover(null)}
      onClick={(e) => {
        if (e.delta > 4 || e.instanceId === undefined) return;
        e.stopPropagation();
        onClick(e.instanceId, e);
      }}
    />
  );
}

// ---------- outlines ----------

function OutlineLines({ lines, country, color, opacity, y }: { lines: number[][]; country: Country; color: Color; opacity: number; y: number }) {
  const geometry = useMemo(() => {
    const pos: number[] = [];
    for (const line of lines) {
      const n = line.length / 2;
      for (let i = 0; i < n - 1; i++) {
        const a = i, b = i + 1;
        const [ax, az] = toWorld(line[a * 2]!, line[a * 2 + 1]!, country);
        const [bx, bz] = toWorld(line[b * 2]!, line[b * 2 + 1]!, country);
        pos.push(ax, y, az, bx, y, bz);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    return g;
  }, [lines, country, y]);
  const material = useMemo(() => new LineBasicMaterial({ transparent: true }), []);
  material.color.copy(color);
  material.opacity = opacity;
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <lineSegments args={[geometry, material]} renderOrder={1} />;
}

// ---------- camera ----------

/**
 * Container aspect ratio. A tilted map is foreshortened, so the box is shorter than the
 * flat map's (USA: ~975×604, close to the 2D view's 975×610).
 */
function sceneAspect(country: Country): string {
  const { width: w, height: h } = country.geometry;
  return `${w} / ${Math.round(Math.max(h * 0.7, w * 0.62))}`;
}

const FOV = 35;

/** World-space extent of the columns: ground footprint plus tallest column. */
export interface SceneBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number;
}

/**
 * Find a camera orbit (distance + target) at the given tilt/rotation that fits the
 * whole box in view and centers it on screen.
 */
function fitView(box: SceneBox, phi: number, theta: number, aspect: number): { sph: Spherical; target: Vector3 } {
  const cam = new PerspectiveCamera(FOV, aspect, 1, 10000);
  const pts: Vector3[] = [];
  for (const x of [box.minX, box.maxX]) for (const z of [box.minZ, box.maxZ]) for (const y of [0, box.maxY]) pts.push(new Vector3(x, y, z));
  const target = new Vector3((box.minX + box.maxX) / 2, 0, (box.minZ + box.maxZ) / 2);
  const p = new Vector3();
  const extents = (d: number) => {
    cam.position.setFromSpherical(new Spherical(d, phi, theta)).add(target);
    cam.lookAt(target);
    cam.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const v of pts) {
      p.copy(v).project(cam);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    return { x0, x1, y0, y1 };
  };
  const fits = (d: number) => {
    const e = extents(d);
    return e.x0 >= -0.94 && e.x1 <= 0.94 && e.y0 >= -0.86 && e.y1 <= 0.86;
  };
  let d = 1000;
  // Direction "up the screen" on the ground plane (away from the camera).
  const away = new Vector3(-Math.sin(theta), 0, -Math.cos(theta));
  const depth = Math.max(box.maxX - box.minX, box.maxZ - box.minZ);
  for (let iter = 0; iter < 4; iter++) {
    let lo = 100, hi = 8000;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    d = hi;
    const e = extents(d);
    const midY = (e.y0 + e.y1) / 2;
    if (Math.abs(midY) < 0.01) break;
    // Content sits high on screen → aim further away from the camera, and vice versa.
    target.addScaledVector(away, midY * depth * 0.35);
  }
  return { sph: new Spherical(d, phi, theta), target };
}

interface CameraRigProps {
  box: SceneBox;
  tilt: number;
  rotation: number;
  /** Increments to trigger a (re)play of the top-down → tilted intro. */
  introKey: number;
  /** Increments to animate back to the default view. */
  resetKey: number;
  animate: boolean;
  controls: boolean;
  wheelZoom: "modifier" | "always" | "off";
  autoRotate: boolean;
  onWheelBlocked: () => void;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function CameraRig({ box, tilt, rotation, introKey, resetKey, animate, controls, wheelZoom, autoRotate, onWheelBlocked }: CameraRigProps) {
  const { camera, gl, invalidate, size } = useThree();
  const orbit = useRef<OrbitControls | null>(null);
  const flight = useRef<{
    from: Spherical;
    fromTarget: Vector3;
    to: Spherical;
    toTarget: Vector3;
    start: number;
    duration: number;
  } | null>(null);
  const blockedRef = useRef(onWheelBlocked);
  blockedRef.current = onWheelBlocked;

  const aspect = size.width / Math.max(1, size.height);
  const boxKey = `${box.minX},${box.maxX},${box.minZ},${box.maxZ},${box.maxY}`;
  const fitted = useMemo(
    () => fitView(box, (Math.min(80, Math.max(0, tilt)) * Math.PI) / 180, (rotation * Math.PI) / 180, aspect),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boxKey, tilt, rotation, aspect],
  );
  // Top-down framing for the start of the intro.
  const topDown = useMemo(
    () => fitView(box, 0.0001, (rotation * Math.PI) / 180, aspect),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boxKey, rotation, aspect],
  );
  const goal = fitted.sph;

  useEffect(() => {
    const el = gl.domElement;
    // Registered before OrbitControls so it can swallow un-modified wheel events.
    const onWheel = (e: WheelEvent) => {
      if (wheelZoom === "off" || (wheelZoom === "modifier" && !e.ctrlKey && !e.metaKey)) {
        e.stopImmediatePropagation();
        if (wheelZoom === "modifier") blockedRef.current();
      }
    };
    el.addEventListener("wheel", onWheel, { capture: true });
    const c = new OrbitControls(camera, el);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minDistance = 220;
    c.maxDistance = 1800;
    c.maxPolarAngle = 1.38;
    c.zoomToCursor = true;
    c.screenSpacePanning = false;
    orbit.current = c;
    return () => {
      el.removeEventListener("wheel", onWheel, { capture: true });
      c.dispose();
      orbit.current = null;
    };
  }, [camera, gl, wheelZoom]);

  const flyTo = useCallback(
    (to: Spherical, toTarget: Vector3, from?: { sph: Spherical; target: Vector3 }, duration = 1.4) => {
      const c = orbit.current;
      const curTarget = c?.target.clone() ?? new Vector3();
      const current = new Spherical().setFromVector3(camera.position.clone().sub(curTarget));
      flight.current = {
        from: from?.sph ?? current,
        fromTarget: from?.target.clone() ?? curTarget,
        to,
        toTarget: toTarget.clone(),
        start: performance.now(),
        duration: animate ? duration : 0,
      };
      invalidate();
    },
    [camera, animate, invalidate],
  );

  // Intro: straight down → tilted. Replays when the layout changes.
  useEffect(() => {
    flyTo(goal, fitted.target, topDown, 1.6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introKey]);
  useEffect(() => {
    if (resetKey > 0) flyTo(goal, fitted.target, undefined, 1.1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);
  // Tilt / rotation / size changes: glide to the new framing.
  const firstFit = useRef(true);
  useEffect(() => {
    if (firstFit.current) {
      firstFit.current = false;
      return;
    }
    if (!flight.current) flyTo(goal, fitted.target, undefined, 0.9);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitted]);

  useFrame(() => {
    const c = orbit.current;
    const f = flight.current;
    if (f) {
      const t = f.duration === 0 ? 1 : Math.min(1, (performance.now() - f.start) / (f.duration * 1000));
      const e = easeInOut(t);
      const s = new Spherical(
        f.from.radius + (f.to.radius - f.from.radius) * e,
        f.from.phi + (f.to.phi - f.from.phi) * e,
        f.from.theta + (f.to.theta - f.from.theta) * e,
      );
      const target = f.fromTarget.clone().lerp(f.toTarget, e);
      camera.position.setFromSpherical(s).add(target);
      camera.lookAt(target);
      if (c) c.target.copy(target);
      if (t >= 1) flight.current = null;
    }
    if (c) {
      c.enabled = controls && !f;
      c.autoRotate = autoRotate && !f;
      c.autoRotateSpeed = 0.6;
      if (!f) c.update();
    }
  });

  return null;
}

// ---------- main component ----------

export function HexMap3D<T extends HexDatum = HexDatum>(props: HexMap3DProps<T>) {
  const {
    country = USA,
    layout: layoutType = "grid",
    resolution = 7,
    hexSize,
    tileGap = 0.05,
    data,
    value,
    aggregate,
    colorScale,
    getTileStyle,
    showStateBorders = false,
    showOutline = false,
    tooltip = true,
    legend,
    format = defaultFormat,
    valueLabel = "Value",
    selectedTileId,
    onTileClick,
    onTileHover,
    theme: themeOption,
    animate: animateProp = true,
    entrance = "ripple",
    heightScale = 110,
    baseHeight = 1.5,
    heightTransform,
    tilt = 52,
    rotation = 0,
    controls = true,
    wheelZoom = "modifier",
    autoRotate = false,
    shadows = true,
    className,
    style,
  } = props;

  const theme = useResolvedTheme(themeOption);
  const v = (k: keyof HexMapTheme) => cssVar(theme, k);
  const containerRef = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(prefersReducedMotion()), []);
  const animate = animateProp && !reduced;

  // ----- model -----
  const size = hexSize ?? resolutionToHexSize(resolution);
  const layout = useMemo(
    () => (layoutType === "states" ? buildStatesLayout(country) : buildHexGrid({ country, hexSize: size })),
    [country, layoutType, size],
  );
  const bound: BoundData<T> = useMemo(() => bindData(layout, data ?? [], { value, aggregate }), [layout, data, value, aggregate]);
  const scaleKey = JSON.stringify(colorScale ?? null);
  const scale: ColorScale = useMemo(
    () => createColorScale(colorScale ?? { type: "sequential" }, bound.values()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scaleKey, bound],
  );
  const hTransform =
    heightTransform ?? (colorScale?.type === "sequential" ? (colorScale.transform ?? "linear") : "linear");
  const domainKey = scale.domain.join(",");

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const selectedIndex = useMemo(
    () => (selectedTileId ? layout.tiles.findIndex((t) => t.id === selectedTileId) : -1),
    [layout, selectedTileId],
  );

  const targets = useMemo<ColumnTargets>(() => {
    const n = layout.tiles.length;
    const heights = new Float32Array(n);
    const colors = new Float32Array(n * 3);
    const delays = new Float32Array(n);
    const frac = heightFraction(hTransform, extent(bound.values()));
    const empty = parseColor(theme.empty).color;
    const highlight = parseColor(theme.highlight).color;
    for (let i = 0; i < n; i++) {
      const tile = layout.tiles[i]!;
      const d = bound.get(tile.id, tile.state.code);
      const base: TileStyle = {
        fill: d ? scale.color(d.value) : theme.empty,
        stroke: theme.stroke,
        strokeWidth: 0,
        opacity: 1,
        height: d ? baseHeight + frac(d.value) * heightScale : baseHeight,
      };
      const s = getTileStyle
        ? { ...base, ...getTileStyle({ ...tile, data: d }, { scale, defaultStyle: base, hovered: i === hoverIndex }) }
        : base;
      heights[i] = Math.max(0.01, s.height);
      tmpColor.copy(d || s.fill !== base.fill ? parseColor(s.fill).color : empty);
      if (i === selectedIndex) tmpColor.lerp(highlight, 0.45);
      else if (i === hoverIndex) tmpColor.lerp(highlight, 0.28);
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
      delays[i] = entrance === "none" ? 0 : revealDelay(entrance as Entrance, tile.x, tile.y, tile.q, tile.r) * 1.3;
    }
    return { heights, colors, delays };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, bound, scale, theme, getTileStyle, hoverIndex, selectedIndex, heightScale, baseHeight, hTransform, domainKey, entrance]);

  // ----- entrance (starts when the map scrolls into view) -----
  const clockRef = useRef<{ elapsedTime: number } | null>(null);
  const [revealStart, setRevealStart] = useState<number | null>(null);
  const [introKey, setIntroKey] = useState(0);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (setVisible(true), io.disconnect()), {
      threshold: 0.2,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const layoutKey = `${country.id}|${layoutType}|${size}`;
  useEffect(() => {
    if (!visible) return;
    setRevealStart(clockRef.current?.elapsedTime ?? 0);
    setIntroKey((k) => k + 1);
  }, [visible, layoutKey]);

  // ----- hover / tooltip -----
  const tipX = useMotionValue(0);
  const tipY = useMotionValue(0);
  const springX = useSpring(tipX, { stiffness: 600, damping: 45 });
  const springY = useSpring(tipY, { stiffness: 600, damping: 45 });
  const [flip, setFlip] = useState(false);
  const hoverTile: TileWithData<T> | null = useMemo(() => {
    const t = hoverIndex !== null ? layout.tiles[hoverIndex] : undefined;
    return t ? { ...t, data: bound.get(t.id, t.state.code) } : null;
  }, [hoverIndex, layout, bound]);

  const onHover = useCallback(
    (index: number | null, e?: ThreeEvent<PointerEvent>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (e && rect) {
        const px = e.nativeEvent.clientX - rect.left;
        const py = e.nativeEvent.clientY - rect.top;
        const first = hoverIndex === null;
        tipX.set(px);
        tipY.set(py);
        if (first) {
          springX.jump(px);
          springY.jump(py);
        }
        setFlip(px > rect.width - 220);
      }
      if (e && e.buttons) index = null; // orbiting
      if (index !== hoverIndex) {
        setHoverIndex(index);
        const t: HexTile | undefined = index !== null ? layout.tiles[index] : undefined;
        onTileHover?.(t ? { ...t, data: bound.get(t.id, t.state.code) } : null);
      }
    },
    [hoverIndex, layout, bound, onTileHover, tipX, tipY, springX, springY],
  );
  const onClick = useCallback(
    (index: number, e: ThreeEvent<MouseEvent>) => {
      const t = layout.tiles[index];
      if (t && onTileClick) onTileClick({ ...t, data: bound.get(t.id, t.state.code) }, e.nativeEvent);
    },
    [layout, bound, onTileClick],
  );

  // ----- wheel hint -----
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onWheelBlocked = useCallback(() => {
    const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
    setHint(`Hold ${mac ? "⌘" : "Ctrl"} and scroll to zoom`);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 1400);
  }, []);
  useEffect(() => () => clearTimeout(hintTimer.current), []);

  const [resetKey, setResetKey] = useState(0);

  // ----- overlays -----
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setCompact((e?.contentRect.width ?? 1000) < 520));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const legendCfg = legend === undefined ? (data?.length ? {} : false) : legend === true ? {} : legend;
  const legendPos: Corner | "below" = (legendCfg && legendCfg.position) || "below";
  const corner = (c: Corner): CSSProperties => ({
    position: "absolute",
    [c.startsWith("top") ? "top" : "bottom"]: compact ? 6 : 12,
    [c.endsWith("left") ? "left" : "right"]: compact ? 6 : 12,
  });

  // Ground footprint of the tiles + tallest possible column, for camera framing.
  const box = useMemo<SceneBox>(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const t of layout.tiles) {
      const [wx, wz] = toWorld(t.x, t.y, country);
      minX = Math.min(minX, wx - layout.size); maxX = Math.max(maxX, wx + layout.size);
      minZ = Math.min(minZ, wz - layout.size); maxZ = Math.max(maxZ, wz + layout.size);
    }
    let maxY = baseHeight;
    for (let i = 0; i < targets.heights.length; i++) maxY = Math.max(maxY, targets.heights[i]!);
    // Round so tiny changes (hover) don't trigger a re-fit.
    const r = (n: number) => Math.round(n / 5) * 5;
    return { minX: r(minX), maxX: r(maxX), minZ: r(minZ), maxZ: r(maxZ), maxY: r(Math.max(maxY, baseHeight + heightScale * 0.5)) };
  }, [layout, targets.heights, baseHeight, heightScale]);

  const borderColor = parseColor(theme.border);
  const outlineColor = parseColor(theme.outline);
  const radius = layout.size * (1 - tileGap);

  return (
    <div
      ref={containerRef}
      className={className}
      data-hexmap=""
      data-hexmap-3d=""
      style={{ position: "relative", width: "100%", fontFamily: "inherit", ...style }}
      aria-label={props["aria-label"] ?? `3D hexagonal map of ${country.name}`}
      role="img"
      onPointerLeave={() => onHover(null)}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: sceneAspect(country) }}>
      <Canvas
        shadows={shadows}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: FOV, near: 1, far: 12000, position: [0, 1200, 0.1] }}
        onCreated={({ clock, camera }) => {
          clockRef.current = clock;
          (camera as PerspectiveCamera).lookAt(0, 0, 0);
        }}
        style={{ position: "absolute", inset: 0, touchAction: controls ? "none" : "auto", cursor: hoverIndex !== null && onTileClick ? "pointer" : controls ? "grab" : "default" }}
      >
        <hemisphereLight args={["#ffffff", "#bbb6b0", 1.1]} />
        <directionalLight
          position={[-320, 620, 380]}
          intensity={1.7}
          castShadow={shadows}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-country.geometry.width / 2 - 140}
          shadow-camera-right={country.geometry.width / 2 + 140}
          shadow-camera-top={country.geometry.height / 2 + 110}
          shadow-camera-bottom={-country.geometry.height / 2 - 110}
          shadow-camera-near={10}
          shadow-camera-far={2000}
          shadow-bias={-0.0004}
        />
        <Columns
          layout={layout}
          radius={radius}
          targets={targets}
          revealStart={revealStart}
          animate={animate}
          shadows={shadows}
          onHover={onHover}
          onClick={onClick}
        />
        {showStateBorders && layoutType === "grid" && (
          <OutlineLines lines={country.geometry.borders} country={country} color={borderColor.color} opacity={borderColor.alpha} y={0.4} />
        )}
        {showOutline && layoutType === "grid" && (
          <OutlineLines lines={country.geometry.outline} country={country} color={outlineColor.color} opacity={outlineColor.alpha} y={0.5} />
        )}
        <CameraRig
          box={box}
          tilt={tilt}
          rotation={rotation}
          introKey={introKey}
          resetKey={resetKey}
          animate={animate}
          controls={controls}
          wheelZoom={wheelZoom}
          autoRotate={autoRotate}
          onWheelBlocked={onWheelBlocked}
        />
      </Canvas>
      </div>

      {legendCfg && legendPos === "below" && (
        <div data-hexmap-legend-row="" style={{ display: "flex", justifyContent: "flex-end", marginTop: compact ? 6 : 10 }}>
          <HexMapLegend scale={scale} title={legendCfg.title} format={legendCfg.format ?? format} theme={theme} compact={compact} />
        </div>
      )}

      <TooltipOverlay open={!!hoverTile && tooltip !== false} x={springX} y={springY} flip={flip} theme={theme}>
        {hoverTile &&
          (typeof tooltip === "function" ? (
            tooltip(hoverTile)
          ) : (
            <DefaultTooltipContent tile={hoverTile} theme={theme} valueLabel={valueLabel} format={format} />
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

      {controls && (
        <motion.button
          type="button"
          aria-label="Reset view"
          whileTap={{ scale: 0.9 }}
          onClick={() => setResetKey((k) => k + 1)}
          style={{
            ...corner(legendPos === "top-right" ? "top-left" : "top-right"),
            zIndex: 1,
            width: compact ? 24 : 30,
            height: compact ? 24 : 30,
            display: "grid",
            placeItems: "center",
            borderRadius: 10,
            background: v("surface"),
            border: `1px solid ${v("surfaceBorder")}`,
            color: v("text"),
            cursor: "pointer",
            fontSize: 13,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          ⤢
        </motion.button>
      )}

      {hint && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
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
    </div>
  );
}
