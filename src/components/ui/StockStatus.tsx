import type { CSSProperties } from "react";

/* StockStatus — dot + label. States: in / order / out. Label is localized
   and passed in; the dot color is driven by status. */

export type StockState = "in" | "order" | "out";

const DOT: Record<StockState, string> = {
  in: "var(--state-success)",
  order: "var(--brass)",
  out: "var(--state-danger)",
};

export interface StockStatusProps {
  status?: StockState;
  label: string;
  size?: "sm" | "md";
  style?: CSSProperties;
}

export function StockStatus({ status = "in", label, size = "md", style }: StockStatusProps) {
  const fs = size === "sm" ? "var(--text-caption)" : "var(--text-body-s)";
  const dot = size === "sm" ? 7 : 8;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--font-sans)",
        fontSize: fs,
        color: "var(--text-secondary)",
        lineHeight: 1,
        ...style,
      }}
    >
      <span style={{ width: dot, height: dot, borderRadius: 999, background: DOT[status], flex: "none" }} />
      <span style={{ color: status === "out" ? "var(--state-danger)" : "var(--text-primary)" }}>{label}</span>
    </span>
  );
}
