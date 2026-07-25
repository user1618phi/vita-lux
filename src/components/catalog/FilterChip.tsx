import type { CSSProperties, ReactNode } from "react";
import { Link } from "@/i18n/navigation";

/* FilterChip — a toggle rendered as a locale-aware link (filtering happens on
   the server via the URL, so this needs no client JS). Filled when active.
   44px tall to clear the 44×44 touch target we aim for. */

export interface FilterChipProps {
  href: string;
  active: boolean;
  children: ReactNode;
  style?: CSSProperties;
}

export function FilterChip({ href, active, children, style }: FilterChipProps) {
  return (
    <Link
      href={href}
      role="button"
      aria-pressed={active}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        padding: "0 16px",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-body-s)",
        fontWeight: active ? 500 : 400,
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        textDecoration: "none",
        color: active ? "var(--text-on-dark)" : "var(--text-primary)",
        background: active ? "var(--ink)" : "var(--surface-card)",
        border: active ? "1px solid var(--ink)" : "1px solid var(--border-control)",
        borderRadius: "var(--radius-md)",
        transition: "background var(--transition), color var(--transition), border-color var(--transition)",
        ...style,
      }}
    >
      {children}
    </Link>
  );
}
