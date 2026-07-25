"use client";

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { useState } from "react";

/* Kaspi channel button. The Kaspi red (#F14635) appears ONLY here.
   Radius 8px, weight 500. Used for "Купить в Kaspi" / "Рассрочка 0-0-12". */

export interface KaspiButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  children?: ReactNode;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  style?: CSSProperties;
}

export function KaspiButton({
  children,
  size = "md",
  fullWidth = false,
  disabled = false,
  style,
  ...rest
}: KaspiButtonProps) {
  const H = size === "lg" ? 56 : size === "sm" ? 40 : 48;
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        height: H,
        minHeight: H,
        padding: "0 20px",
        width: fullWidth ? "100%" : undefined,
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-body)",
        fontWeight: 500,
        lineHeight: 1,
        color: "#fff",
        background: hover && !disabled ? "#D93A2B" : "var(--kaspi-red)",
        border: "none",
        borderRadius: "var(--radius-md)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "background var(--transition)",
        WebkitTapHighlightColor: "transparent",
        ...style,
      }}
      {...rest}
    >
      <span style={{ fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: 18, letterSpacing: "-0.02em" }}>
        Kaspi
      </span>
      <span style={{ opacity: 0.85 }}>{children}</span>
    </button>
  );
}
