import { animate, useMotionValue, type MotionValue } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export interface View {
  k: number;
  x: number;
  y: number;
}

export interface PanZoomOptions {
  enabled: boolean;
  /** Size of the map space (the SVG viewBox). */
  width: number;
  height: number;
  minZoom: number;
  maxZoom: number;
  /** "modifier" requires ⌘/Ctrl (trackpad pinch always works); "always" zooms on any wheel. */
  wheel: "modifier" | "always" | "off";
  onWheelBlocked?: () => void;
}

export interface PanZoom {
  k: MotionValue<number>;
  x: MotionValue<number>;
  y: MotionValue<number>;
  /** Debounced view, for work that shouldn't run on every frame (culling, adaptive resolution). */
  view: View;
  zoomBy(factor: number, center?: [number, number]): void;
  reset(): void;
  /** Convert client (screen) coordinates to map space. */
  toMap(clientX: number, clientY: number): [number, number] | null;
  /** True for the click that ends a drag, so it can be ignored. */
  wasDragged(): boolean;
}

const spring = { type: "spring", stiffness: 260, damping: 32, mass: 0.8 } as const;

export function usePanZoom(svgRef: RefObject<SVGSVGElement | null>, opts: PanZoomOptions): PanZoom {
  const k = useMotionValue(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const dragged = useRef(false);
  /** Where the view is heading (equals the current view when not animating). */
  const target = useRef<View>({ k: 1, x: 0, y: 0 });

  // Debounced view state.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(t);
      t = setTimeout(() => setView({ k: k.get(), x: x.get(), y: y.get() }), 140);
    };
    const subs = [k.on("change", update), x.on("change", update), y.on("change", update)];
    return () => {
      clearTimeout(t);
      subs.forEach((u) => u());
    };
  }, [k, x, y]);

  const clamp = useCallback((nk: number, nx: number, ny: number): View => {
    const { minZoom, maxZoom } = optsRef.current;
    const kk = Math.min(maxZoom, Math.max(minZoom, nk));
    // Keep the map covering the viewport when zoomed in; centered when zoomed out.
    const clampAxis = (v: number, size: number) =>
      kk >= 1 ? Math.min(0, Math.max(size * (1 - kk), v)) : (size * (1 - kk)) / 2;
    return { k: kk, x: clampAxis(nx, optsRef.current.width), y: clampAxis(ny, optsRef.current.height) };
  }, []);

  const set = useCallback(
    (v: View, animated: boolean) => {
      const c = clamp(v.k, v.x, v.y);
      target.current = c;
      if (animated) {
        animate(k, c.k, spring);
        animate(x, c.x, spring);
        animate(y, c.y, spring);
      } else {
        k.stop(); x.stop(); y.stop();
        k.set(c.k); x.set(c.x); y.set(c.y);
      }
    },
    [clamp, k, x, y],
  );

  const toViewBox = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return null;
      return [((clientX - rect.left) / rect.width) * optsRef.current.width, ((clientY - rect.top) / rect.height) * optsRef.current.height];
    },
    [svgRef],
  );

  const zoomAround = useCallback(
    (factor: number, center: [number, number], animated: boolean) => {
      // Zoom relative to the animation target so rapid clicks accumulate.
      const from = animated ? target.current : { k: k.get(), x: x.get(), y: y.get() };
      const nk = Math.min(optsRef.current.maxZoom, Math.max(optsRef.current.minZoom, from.k * factor));
      const ratio = nk / from.k;
      set({ k: nk, x: center[0] - (center[0] - from.x) * ratio, y: center[1] - (center[1] - from.y) * ratio }, animated);
    },
    [k, x, y, set],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !opts.enabled) return;

    const onWheel = (e: WheelEvent) => {
      const mode = optsRef.current.wheel;
      if (mode === "off") return;
      if (mode === "modifier" && !e.ctrlKey && !e.metaKey) {
        optsRef.current.onWheelBlocked?.();
        return;
      }
      e.preventDefault();
      const p = toViewBox(e.clientX, e.clientY);
      if (!p) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const factor = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.002));
      zoomAround(factor, p, false);
    };

    const pointers = new Map<number, [number, number]>();
    let last: { mid: [number, number]; dist: number } | null = null;
    let travel = 0;

    const snapshot = () => {
      const pts = [...pointers.values()];
      if (pts.length === 1) return { mid: pts[0]!, dist: 0 };
      const [a, b] = pts as [[number, number], [number, number]];
      return { mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as [number, number], dist: Math.hypot(a[0] - b[0], a[1] - b[1]) };
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const p = toViewBox(e.clientX, e.clientY);
      if (!p) return;
      pointers.set(e.pointerId, p);
      if (pointers.size > 2) return;
      svg.setPointerCapture(e.pointerId);
      last = snapshot();
      if (pointers.size === 1) {
        travel = 0;
        dragged.current = false;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId) || !last) return;
      const p = toViewBox(e.clientX, e.clientY);
      if (!p) return;
      pointers.set(e.pointerId, p);
      const next = snapshot();
      const dx = next.mid[0] - last.mid[0];
      const dy = next.mid[1] - last.mid[1];
      travel += Math.abs(dx) + Math.abs(dy);
      if (travel > 4) dragged.current = true;
      if (!dragged.current) return;
      let nk = k.get();
      let nx = x.get() + dx;
      let ny = y.get() + dy;
      if (pointers.size === 2 && last.dist > 0) {
        const ratio = Math.min(optsRef.current.maxZoom, Math.max(optsRef.current.minZoom, nk * (next.dist / last.dist))) / nk;
        nx = next.mid[0] - (next.mid[0] - nx) * ratio;
        ny = next.mid[1] - (next.mid[1] - ny) * ratio;
        nk *= ratio;
      }
      set({ k: nk, x: nx, y: ny }, false);
      last = next;
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      last = pointers.size ? snapshot() : null;
    };
    const onDbl = (e: MouseEvent) => {
      const p = toViewBox(e.clientX, e.clientY);
      if (p) zoomAround(e.shiftKey ? 0.5 : 2, p, true);
    };

    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onUp);
    svg.addEventListener("dblclick", onDbl);
    return () => {
      svg.removeEventListener("wheel", onWheel);
      svg.removeEventListener("pointerdown", onDown);
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
      svg.removeEventListener("pointercancel", onUp);
      svg.removeEventListener("dblclick", onDbl);
    };
  }, [opts.enabled, svgRef, toViewBox, zoomAround, set, k, x, y]);

  // Re-clamp if zoom limits change.
  useEffect(() => {
    set({ k: k.get(), x: x.get(), y: y.get() }, false);
  }, [opts.minZoom, opts.maxZoom, set, k, x, y]);

  return {
    k,
    x,
    y,
    view,
    zoomBy: (factor, center) => zoomAround(factor, center ?? [optsRef.current.width / 2, optsRef.current.height / 2], true),
    reset: () => set({ k: 1, x: 0, y: 0 }, true),
    toMap: (cx, cy) => {
      const p = toViewBox(cx, cy);
      if (!p) return null;
      return [(p[0] - x.get()) / k.get(), (p[1] - y.get()) / k.get()];
    },
    wasDragged: () => dragged.current,
  };
}
