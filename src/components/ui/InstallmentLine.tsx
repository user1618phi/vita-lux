import type { CSSProperties } from "react";
import { formatTenge, installmentPerMonth } from "@/lib/format";

/* InstallmentLine — "В рассрочку от 15 750 ₸ × 12 мес".
   Amount + months in monospace. Labels are passed in (localized). */

export interface InstallmentLineProps {
  total: number;
  months?: number;
  perMonth?: number;
  fromLabel: string;
  monthsLabel: string;
  style?: CSSProperties;
}

export function InstallmentLine({
  total,
  months = 12,
  perMonth,
  fromLabel,
  monthsLabel,
  style,
}: InstallmentLineProps) {
  const value = perMonth != null ? perMonth : installmentPerMonth(total, months);
  const mono: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontVariantNumeric: "tabular-nums",
    color: "var(--text-primary)",
  };
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        flexWrap: "wrap",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-body-s)",
        color: "var(--text-secondary)",
        lineHeight: 1.35,
        ...style,
      }}
    >
      <span>{fromLabel}</span>
      <span style={mono}>{formatTenge(value)}</span>
      <span>×</span>
      <span style={mono}>{months}</span>
      <span>{monthsLabel}</span>
    </div>
  );
}
