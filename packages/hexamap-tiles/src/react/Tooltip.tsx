import { AnimatePresence, motion, type MotionValue } from "framer-motion";
import type { ReactNode } from "react";
import type { HexDatum, TileWithData } from "../types";
import { cssVar, type HexMapTheme } from "./theme";

export function DefaultTooltipContent<T extends HexDatum>({
  tile,
  theme,
  valueLabel,
  format,
}: {
  tile: TileWithData<T>;
  theme: HexMapTheme;
  valueLabel: string;
  format: (v: number) => string;
}) {
  const muted = cssVar(theme, "muted");
  return (
    <>
      <div style={{ fontWeight: 600, fontSize: 12 }}>{tile.state.name}</div>
      {tile.data ? (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 4, fontSize: 12 }}>
          <span style={{ color: muted }}>{valueLabel}</span>
          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{format(tile.data.value)}</span>
        </div>
      ) : (
        <div style={{ color: muted, fontSize: 12, marginTop: 2 }}>No data</div>
      )}
      {tile.data && tile.data.count > 1 && tile.data.source === "tile" && (
        <div style={{ color: muted, fontSize: 11, marginTop: 2 }}>{tile.data.count.toLocaleString()} records</div>
      )}
      {tile.data?.source === "state" && <div style={{ color: muted, fontSize: 11, marginTop: 2 }}>State-level value</div>}
    </>
  );
}

/** Floating tooltip card that follows (spring-smoothed) container-relative coordinates. */
export function TooltipOverlay({
  open,
  x,
  y,
  flip,
  theme,
  children,
}: {
  open: boolean;
  x: MotionValue<number>;
  y: MotionValue<number>;
  flip: boolean;
  theme: HexMapTheme;
  children: ReactNode;
}) {
  const v = (k: keyof HexMapTheme) => cssVar(theme, k);
  return (
    <AnimatePresence>
      {open && (
        <motion.div key="tooltip" style={{ position: "absolute", left: 0, top: 0, x, y, pointerEvents: "none", zIndex: 2 }}>
          <div style={{ transform: flip ? "translate(calc(-100% - 14px), -50%)" : "translate(14px, -50%)" }}>
            <motion.div
              data-hexmap-tooltip=""
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              style={{
                minWidth: 140,
                maxWidth: 260,
                padding: "8px 10px",
                borderRadius: 10,
                background: v("surface"),
                border: `1px solid ${v("surfaceBorder")}`,
                color: v("text"),
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                boxShadow: "0 8px 24px -8px rgba(0,0,0,0.25)",
                whiteSpace: "nowrap",
              }}
            >
              {children}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
