import type { CSSProperties, ReactNode } from "react";

/* Badge — small status/label chip for UI (distinct from ProductLabel which sits
   on product media). Variants map to the semantic palette. 4px radius. */

const V = {
  neutral: { bg: "var(--porcelain)", color: "var(--text-primary)", border: "var(--border)" },
  brass: { bg: "var(--tint-brass)", color: "var(--brass-text)", border: "var(--tint-brass-border)" },
  success: { bg: "var(--tint-success)", color: "var(--state-success)", border: "var(--tint-success-border)" },
  danger: { bg: "var(--tint-danger)", color: "var(--state-danger)", border: "var(--tint-danger-border)" },
  info: { bg: "var(--tint-info)", color: "var(--water)", border: "var(--tint-info-border)" },
  solid: { bg: "var(--ink)", color: "var(--action-primary-text)", border: "var(--ink)" },
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
