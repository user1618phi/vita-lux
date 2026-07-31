import { getTranslations } from "next-intl/server";
import { FilterChip } from "./FilterChip";
import { toggleHref, type ActiveFilters, type CategoryFilterConfig, type RawSearchParams } from "@vita/core/catalog";

/* QuickChips — тип выпуска и тип монтажа как горизонтальная лента над сеткой на
   мобильном: эти два фильтра должны быть видны сразу, без открытия шторки. */

export interface QuickChipsProps {
  base: string;
  params: RawSearchParams;
  filters: ActiveFilters;
  config: CategoryFilterConfig;
}

export async function QuickChips({ base, params, filters, config }: QuickChipsProps) {
  const t = await getTranslations("Filters");
  if (config.outlet.length === 0 && config.mount.length === 0) return null;
  return (
    <div className="vl-noscroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
      {config.outlet.map((v) => (
        <FilterChip
          key={`o-${v}`}
          href={toggleHref(base, params, "outlet", v)}
          active={filters.outlet.includes(v)}
          style={{ flex: "none" }}
        >
          {t(`outlet.${v}`)}
        </FilterChip>
      ))}
      <span aria-hidden="true" style={{ flex: "none", width: 1, alignSelf: "stretch", background: "var(--border)", margin: "6px 2px" }} />
      {config.mount.map((v) => (
        <FilterChip
          key={`m-${v}`}
          href={toggleHref(base, params, "mount", v)}
          active={filters.mount.includes(v)}
          style={{ flex: "none" }}
        >
          {t(`mount.${v}`)}
        </FilterChip>
      ))}
    </div>
  );
}
