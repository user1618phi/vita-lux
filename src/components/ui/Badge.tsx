import type { CSSProperties, ReactNode } from "react";

/* Badge — small status/label chip for UI (distinct from ProductLabel which sits
   on product media). Variants map to the semantic palette. 4px radius. */

const V = {
  neutral: { bg: "var(--porcelain)", color: "var(--text-primary)", border: "var(--border)" },
  brass: { bg: "rgba(168,123,65,0.12)", color: "var(--brass-text)", border: "rgba(168,123,65,0.28)" },
  success: { bg: "rgba(30,107,74,0.10)", color: "var(--state-success)", border: "rgba(30,107,74,0.25)" },
  danger: { bg: "rgba(179,38,30,0.08)", color: "var(--state-danger)", border: "rgba(179,38,30,0.22)" },
  info: { bg: "rgba(20,73,75,0.08)", color: "var(--water)", border: "rgba(20,73,75,0.20)" },
  solid: { bg: "var(--ink)", color: "#fff", border: "var(--ink)" },
} as const;

export interface BadgeProps {
  variant?: keyof typeof V;
  children: ReactNode;
  mono?: boolean;
  style?: CSSProperties;
}

export function Badge({ variant = "neutral", children, mono = false, style }: BadgeProps) {
  const v = V[variant] ?? V.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 24,
        padding: "0 8px",
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: "var(--text-caption)",
        fontVariantNumeric: mono ? "tabular-nums" : undefined,
        lineHeight: 1,
        color: v.color,
        background: v.bg,
        border: `0.5px solid ${v.border}`,
        borderRadius: "var(--radius-sm)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
