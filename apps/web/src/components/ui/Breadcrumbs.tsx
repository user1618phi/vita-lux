import type { CSSProperties } from "react";
import { Fragment } from "react";
import { Link } from "@/i18n/navigation";
import { Icon } from "./Icon";

/* Breadcrumbs — path trail with chevron separators. Last item is current. */

export interface Crumb {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: Crumb[];
  style?: CSSProperties;
}

const linkStyle: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-body-s)",
  color: "var(--text-primary)",
  textDecoration: "none",
};

export function Breadcrumbs({ items, style }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Хлебные крошки"
      style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, ...style }}
    >
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <Fragment key={i}>
            {last ? (
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-s)", color: "var(--text-secondary)" }}>
                {it.label}
              </span>
            ) : (
              <Link href={it.href ?? "/"} style={linkStyle}>
                {it.label}
              </Link>
            )}
            {!last ? <Icon name="chevron-right" size={16} color="var(--border-strong)" /> : null}
          </Fragment>
        );
      })}
    </nav>
  );
}
