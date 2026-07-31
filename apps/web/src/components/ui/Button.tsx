"use client";

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { useState } from "react";

/* Vita Lux Button — variants: primary | secondary | text | onPhoto.
   Radius 8px (never a pill). No shadow. Weight 500. Motion 180ms ease-out.
   Hover shifts color only (no scale); active darkens slightly.

   `onPhoto` is the one variant that ignores the theme: it sits on photography,
   which is dark in daylight too, so it stays a light plaque in both themes.
   A themed button here would go dark-on-dark in the dark theme and lose the
   hero's primary action. */

const SIZES = {
  sm: { height: 40, padding: "0 14px", font: "var(--text-body-s)", gap: 8 },
  md: { height: 48, padding: "0 20px", font: "var(--text-body)", gap: 8 },
  lg: { height: 56, padding: "0 28px", font: "var(--text-body-l)", gap: 10 },
} as const;

const VARIANTS = {
  primary: {
    background: "var(--action-primary-bg)",
    color: "var(--action-primary-text)",
    border: "0.5px solid var(--action-primary-bg)",
    hover: "var(--action-primary-hover)",
    active: "var(--action-primary-active)",
    padding: undefined as string | undefined,
  },
  secondary: {
    background: "var(--action-secondary-bg)",
    color: "var(--action-secondary-text)",
    border: "1px solid var(--border-control)",
    hover: "var(--action-secondary-hover)",
    active: "var(--action-secondary-active)",
    padding: undefined as string | undefined,
  },
  onPhoto: {
    background: "var(--surface-on-photo)",
    color: "var(--text-on-photo)",
    border: "1px solid var(--surface-on-photo)",
    hover: "var(--surface-on-photo-hover)",
    active: "var(--surface-on-photo-active)",
    padding: undefined as string | undefined,
  },
  text: {
    background: "transparent",
    color: "var(--text-accent)",
    border: "0.5px solid transparent",
    hover: "transparent",
    active: "transparent",
    padding: "0 6px",
  },
} as const;

function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        display: "inline-block",
        animation: "vl-spin 0.7s linear infinite",
      }}
    />
  );
}

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  children?: ReactNode;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
  style?: CSSProperties;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  iconLeft,
  iconRight,
  fullWidth = false,
  disabled = false,
  loading = false,
  type = "button",
  style,
  ...rest
}: ButtonProps) {
  const s = SIZES[size] ?? SIZES.md;
  const v = VARIANTS[variant] ?? VARIANTS.primary;
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const isDisabled = disabled || loading;
  /* Disabled keeps its fill and dims as a whole. Dropping the fill instead left
     the label — which is coloured to sit ON that fill — floating on the page
     underneath, where it reads at roughly nothing against either theme. */
  const bg = isDisabled ? v.background : active ? v.active : hover ? v.hover : v.background;
  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setActive(false);
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: s.gap,
        minHeight: s.height,
        height: s.height,
        padding: v.padding ?? s.padding,
        width: fullWidth ? "100%" : undefined,
        fontFamily: "var(--font-sans)",
        fontSize: s.font,
        fontWeight: 500,
        lineHeight: 1,
        letterSpacing: "0.005em",
        color: v.color,
        background: bg,
        border: v.border,
        borderRadius: "var(--radius-md)",
        cursor: isDisabled ? (loading ? "progress" : "not-allowed") : "pointer",
        opacity: disabled && !loading ? 0.4 : 1,
        textDecoration: variant === "text" && hover ? "underline" : "none",
        textUnderlineOffset: "3px",
        transition: "background var(--transition), color var(--transition), border-color var(--transition)",
        WebkitTapHighlightColor: "transparent",
        ...style,
      }}
      {...rest}
    >
      {loading ? <Spinner size={(size === "lg" ? 24 : 20) - 2} /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
}
