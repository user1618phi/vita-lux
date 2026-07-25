import type { CSSProperties } from "react";

/* SpecRow — one specification line. Label left, value right in monospace.
   Rows are separated by hairline borders and air, no zebra striping. */

export interface SpecRowProps {
  label: string;
  value: string;
  unit?: string;
  last?: boolean;
  style?: CSSProperties;
}

export function SpecRow({ label, value, unit, last = false, style }: SpecRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 16,
        padding: "12px 0",
        borderBottom: last ? "none" : "0.5px solid var(--border)",
        ...style,
      }}
    >
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-s)", color: "var(--text-secondary)" }}>
        {label}
      </span>
      <span
        className="vl-mono"
        style={{ fontSize: "var(--text-body-s)", color: "var(--text-primary)", textAlign: "right" }}
      >
        {value}
        {unit ? <span style={{ color: "var(--text-secondary)" }}> {unit}</span> : null}
      </span>
    </div>
  );
}
