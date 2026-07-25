import type { CSSProperties, ReactNode } from "react";

/* ProductLabel — small badge on product media: Хит / Скидка / Новинка.
   Solid fill, 4px radius, uppercase micro label. Brass for hit, ink for sale,
   bordered surface for new. */

const KIND = {
  hit: { bg: "var(--brass)", color: "#fff" },
  sale: { bg: "var(--ink)", color: "#fff" },
  new: { bg: "var(--surface-card)", color: "var(--text-primary)", border: true },
} as const;

export interface ProductLabelProps {
  kind?: keyof typeof KIND;
  children: ReactNode;
  style?: CSSProperties;
}

export function ProductLabel({ kind = "hit", children, style }: ProductLabelProps) {
  const k = KIND[kind] ?? KIND.hit;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 22,
        padding: "0 8px",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-micro)",
        fontWeight: 500,
        letterSpacing: "var(--tracking-label)",
        textTransform: "uppercase",
        lineHeight: 1,
        color: k.color,
        background: k.bg,
        borderRadius: "var(--radius-sm)",
        border: "border" in k && k.border ? "1px solid var(--border)" : "none",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
