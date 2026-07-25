import type { CSSProperties } from "react";

/* SIGNATURE ELEMENT — the Dimension Line.
   A thin brass line with serif ticks at both ends and a monospace size label.
   Two jobs only: over a product image to call out dimensions, and as a section
   divider replacing an ordinary rule. Used nowhere else. */

export interface DimensionLineProps {
  label?: string;
  length?: number | string;
  labelBg?: string;
  color?: string;
  style?: CSSProperties;
}

export function DimensionLine({
  label,
  length = "100%",
  labelBg = "var(--surface-card)",
  color = "var(--brass)",
  style,
}: DimensionLineProps) {
  const tick = 8;
  const core: CSSProperties = { position: "absolute", background: color };
  return (
    <div
      role="img"
      aria-label={label ? `Размер: ${label}` : "Размерная линия"}
      style={{ position: "relative", width: length, height: tick * 2, ...style }}
    >
      {/* main line */}
      <div style={{ ...core, left: 0, top: "50%", width: "100%", height: 1, transform: "translateY(-0.5px)" }} />
      {/* left tick */}
      <div style={{ ...core, left: 0, top: `calc(50% - ${tick / 2}px)`, width: 1, height: tick }} />
      {/* right tick */}
      <div style={{ ...core, right: 0, top: `calc(50% - ${tick / 2}px)`, width: 1, height: tick }} />
      {label ? (
        <span
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%,-50%)",
            padding: "0 8px",
            background: labelBg,
            fontFamily: "var(--font-mono)",
            fontVariantNumeric: "tabular-nums",
            fontSize: "var(--text-caption)",
            color,
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
