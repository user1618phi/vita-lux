import type { CSSProperties } from "react";

/* Vita Lux wordmark — a "crown": three dots over a double chevron, plus the
   VITA LUX wordmark and FEEL THE QUALITY tagline. Ported from the brand macket
   and mapped to design tokens. Weight 500 only (бренд запрещает 600/700). */

export interface LogoProps {
  variant?: "dark" | "light";
  showTagline?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Logo({ variant = "dark", showTagline = true, className, style }: LogoProps) {
  const color = variant === "light" ? "var(--porcelain)" : "var(--ink)";
  const tagline = variant === "light" ? "var(--brass-text-dark)" : "var(--brass-text)";
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 10, ...style }}>
      <svg width={32} height={32} viewBox="0 0 100 100" fill="none" aria-hidden="true" style={{ flex: "none", display: "block" }}>
        <circle cx="30" cy="26" r="7" fill={color} />
        <circle cx="50" cy="18" r="7.5" fill={color} />
        <circle cx="70" cy="26" r="7" fill={color} />
        <path d="M22 38 L50 66 L78 38 L68 38 L50 56 L32 38 Z" fill={color} />
        <path d="M22 46 L50 74 L78 46 L68 46 L50 64 L32 46 Z" fill={color} opacity="0.55" />
      </svg>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 500, letterSpacing: "0.2em", color, lineHeight: 1 }}>
          VITA&nbsp;LUX
        </span>
        {showTagline ? (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 8, fontWeight: 500, letterSpacing: "0.34em", color: tagline, marginTop: 4 }}>
            FEEL THE QUALITY
          </span>
        ) : null}
      </span>
    </span>
  );
}
