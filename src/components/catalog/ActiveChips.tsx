import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import {
  activeFilterCount,
  clearFiltersHref,
  priceHref,
  stockHref,
  toggleHref,
  type ActiveFilters,
  type CategoryFilterConfig,
  type RawSearchParams,
} from "@/lib/catalog";

/* ActiveChips — a removable chip per applied filter + a clear-all link. Lets the
   buyer see and undo their selection at a glance while comparing options. */

export interface ActiveChipsProps {
  base: string;
  params: RawSearchParams;
  filters: ActiveFilters;
  config: CategoryFilterConfig;
}

export async function ActiveChips({ base, params, filters, config }: ActiveChipsProps) {
  if (activeFilterCount(filters) === 0) return null;

  const tf = await getTranslations("Filters");
  const tc = await getTranslations("Catalog");

  const chips: { key: string; label: string; href: string }[] = [];
  filters.outlet.forEach((v) => chips.push({ key: `o-${v}`, label: tf(`outlet.${v}`), href: toggleHref(base, params, "outlet", v) }));
  filters.mount.forEach((v) => chips.push({ key: `m-${v}`, label: tf(`mount.${v}`), href: toggleHref(base, params, "mount", v) }));
  filters.collection.forEach((v) => chips.push({ key: `c-${v}`, label: tf(`collections.${v}`), href: toggleHref(base, params, "collection", v) }));
  if (filters.price) chips.push({ key: `p-${filters.price}`, label: tf(`priceBuckets.${filters.price}`), href: priceHref(base, params, filters.price) });
  filters.finish.forEach((v) => chips.push({ key: `f-${v}`, label: tf(`finishes.${v}`), href: toggleHref(base, params, "finish", v) }));
  if (filters.inStockOnly) chips.push({ key: "stock", label: tf("inStockOnly"), href: stockHref(base, params) });

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      {chips.map((c) => (
        <Link
          key={c.key}
          href={c.href}
          aria-label={`${tc("clearOne")}: ${c.label}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            minHeight: 32,
            padding: "0 8px 0 12px",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-caption)",
            color: "var(--text-primary)",
            textDecoration: "none",
            background: "var(--surface-control)",
            border: "1px solid var(--border-control)",
            borderRadius: "var(--radius-md)",
          }}
        >
          {c.label}
          <Icon name="x" size={14} color="var(--slate)" />
        </Link>
      ))}
      <Link
        href={clearFiltersHref(base, params)}
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-caption)",
          color: "var(--text-accent)",
          textDecoration: "underline",
          textUnderlineOffset: "3px",
          minHeight: 32,
          display: "inline-flex",
          alignItems: "center",
          padding: "0 4px",
        }}
      >
        {tc("resetAll")}
      </Link>
    </div>
  );
}
