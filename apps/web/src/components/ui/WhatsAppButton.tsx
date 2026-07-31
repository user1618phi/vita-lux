"use client";

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { WhatsAppGlyph } from "./WhatsAppGlyph";

/* WhatsApp channel button. WhatsApp green (#25D366) appears ONLY here.
   variant: solid (green fill) | outline (green outline for secondary placement). */

export interface WhatsAppButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  children?: ReactNode;
  variant?: "solid" | "outline";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  style?: CSSProperties;
}

export function WhatsAppButton({
  children,
  variant = "solid",
  size = "md",
  fullWidth = false,
  disabled = false,
  style,
  ...rest
}: WhatsAppButtonProps) {
  const H = size === "lg" ? 56 : size === "sm" ? 40 : 48;
  const [hover, setHover] = useState(false);
  const solid = variant === "solid";
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
        gap: 8,
        height: H,
        minHeight: H,
        padding: "0 18px",
        width: fullWidth ? "100%" : undefined,
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-body)",
        fontWeight: 500,
        lineHeight: 1,
        color: solid ? "#fff" : "var(--whatsapp-text)",
        background: solid
          ? hover && !disabled
            ? "#1FB859"
            : "var(--whatsapp-green)"
          : hover
            ? "var(--tint-whatsapp)"
            : "transparent",
        border: solid ? "none" : "1px solid var(--whatsapp-green)",
        borderRadius: "var(--radius-md)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "background var(--transition), color var(--transition)",
        WebkitTapHighlightColor: "transparent",
        ...style,
      }}
      {...rest}
    >
      <WhatsAppGlyph size={22} />
      {children}
    </button>
  );
}
