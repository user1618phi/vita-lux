"use client";

import { useRouter } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import type { SortKey } from "@/lib/catalog";

/* SortSelect — native <select> (best mobile UX) that navigates to a pre-built,
   filter-preserving href on change. Font 16px so iOS doesn't zoom the page. */

export interface SortSelectProps {
  value: SortKey;
  label: string;
  hrefs: Record<SortKey, string>;
  options: { value: SortKey; label: string }[];
  /** Fill the parent width and ellipsize the closed value — used in the mobile
      toolbar where Kazakh sort labels would otherwise overflow the row. */
  block?: boolean;
}

export function SortSelect({ value, label, hrefs, options, block = false }: SortSelectProps) {
  const router = useRouter();
  return (
    <span style={{ position: "relative", display: block ? "flex" : "inline-flex", alignItems: "center", width: block ? "100%" : undefined }}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => router.push(hrefs[e.target.value as SortKey])}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          width: block ? "100%" : undefined,
          height: 44,
          padding: "0 40px 0 14px",
          fontFamily: "var(--font-sans)",
          fontSize: 16,
          color: "var(--text-primary)",
          background: "var(--surface-card)",
          border: "1px solid var(--border-control)",
          borderRadius: "var(--radius-md)",
          cursor: "pointer",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span aria-hidden="true" style={{ position: "absolute", right: 12, pointerEvents: "none", display: "inline-flex" }}>
        <Icon name="chevron-down" size={18} color="var(--slate)" />
      </span>
    </span>
  );
}
