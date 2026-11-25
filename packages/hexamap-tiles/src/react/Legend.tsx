import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import type { ColorScale } from "../core/scale";
import { LIGHT_THEME, cssVar, type HexMapTheme } from "./theme";

export const defaultFormat = (v: number) =>
  new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(v);

export interface HexMapLegendProps {
  scale: ColorScale;
  title?: string;
  format?: (v: number) => string;
  theme?: HexMapTheme;
  /** Smaller variant for narrow containers. */
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function HexMapLegend({ scale, title, format = defaultFormat, theme = LIGHT_THEME, compact = false, className, style }: HexMapLegendProps) {
  const v = (k: keyof HexMapTheme) => cssVar(theme, k);
  const label: CSSProperties = { fontSize: compact ? 9 : 10, color: v("muted"), fontVariantNumeric: "tabular-nums" };

  return (
    <motion.div
      className={className}
      data-hexmap-legend=""
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      style={{
        background: v("surface"),
        border: `1px solid ${v("surfaceBorder")}`,
        color: v("text"),
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderRadius: 10,
        padding: compact ? "5px 7px" : "8px 10px",
        minWidth: compact ? 100 : 160,
        fontFamily: "inherit",
        ...style,
      }}
    >
      {title && <div style={{ fontSize: compact ? 9 : 11, fontWeight: 600, marginBottom: compact ? 4 : 6 }}>{title}</div>}
      {scale.type === "sequential" ? (
        <>
          <div
            style={{
              height: compact ? 5 : 8,
              borderRadius: 4,
              background: `linear-gradient(to right, ${scale.legend.map((s) => s.color).join(", ")})`,
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, ...label }}>
            <span>{format(scale.domain[0])}</span>
            <span>{format(scale.domain[1])}</span>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: 2 }}>
            {scale.legend.map((s, i) => (
              <motion.div
                key={i}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1, backgroundColor: s.color }}
                transition={{ delay: i * 0.03 }}
                style={{ flex: 1, height: 8, borderRadius: 2 }}
              />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, ...label }}>
            <span>{format(scale.legend[0]?.from ?? scale.domain[0])}</span>
            <span>{format(scale.legend[scale.legend.length - 1]?.to ?? scale.domain[1])}</span>
          </div>
        </>
      )}
    </motion.div>
  );
}
