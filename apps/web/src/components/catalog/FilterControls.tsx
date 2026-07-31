import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { FilterChip } from "./FilterChip";
import {
  facetCount,
  priceHref,
  stockHref,
  toggleHref,
  type ActiveFilters,
  type CatalogItem,
  type CategoryFilterConfig,
  type RawSearchParams,
} from "@vita/core/catalog";

/* FilterControls — the full facet set. Rendered on the server and reused by the
   desktop sidebar and the mobile bottom sheet. Тип выпуска и тип монтажа стоят
   первыми и раскрыты — видны сразу, без «ещё фильтры» (см. бриф). */

export interface FilterControlsProps {
  base: string;
  params: RawSearchParams;
  filters: ActiveFilters;
  config: CategoryFilterConfig;
  items: CatalogItem[];
}

const groupStyle = (first: boolean) => ({
  paddingTop: first ? 0 : 20,
  paddingBottom: 20,
  borderTop: first ? "none" : "0.5px solid var(--border)",
});

const headingStyle = {
  margin: "0 0 12px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-caption)",
  fontWeight: 500,
  letterSpacing: "var(--tracking-label)",
  textTransform: "uppercase" as const,
  color: "var(--text-secondary)",
};

function CheckRow({
  href,
  checked,
  label,
  count,
  kind = "check",
}: {
  href: string;
  checked: boolean;
  label: string;
  count?: number;
  kind?: "check" | "radio";
}) {
  const dimmed = count === 0 && !checked;
  return (
    <Link
      href={href}
      role={kind === "radio" ? "radio" : "checkbox"}
      aria-checked={checked}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: 44,
        textDecoration: "none",
        opacity: dimmed ? 0.5 : 1,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: "none",
          width: 20,
          height: 20,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: kind === "radio" ? "50%" : "var(--radius-sm)",
          border: checked ? "1px solid var(--brass)" : "1px solid var(--border-control)",
          background: checked && kind === "check" ? "var(--brass)" : "transparent",
        }}
      >
        {checked && kind === "check" ? <Icon name="check" size={14} color="var(--text-on-brass)" strokeWidth={2} /> : null}
        {checked && kind === "radio" ? (
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--brass)" }} />
        ) : null}
      </span>
      <span style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: "var(--text-body-s)", color: "var(--text-primary)" }}>
        {label}
      </span>
      {typeof count === "number" ? (
        <span className="vl-mono" style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
          {count}
        </span>
      ) : null}
    </Link>
  );
}

export async function FilterControls({ base, params, filters, config, items }: FilterControlsProps) {
  const t = await getTranslations("Filters");

  return (
    <div>
      {/* Тип выпуска — chips, всегда раскрыты (унитазы) */}
      {config.outlet.length > 0 ? (
        <div style={groupStyle(true)}>
          <h3 style={headingStyle}>{t("outletType")}</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {config.outlet.map((v) => (
              <FilterChip key={v} href={toggleHref(base, params, "outlet", v)} active={filters.outlet.includes(v)}>
                {t(`outlet.${v}`)}
              </FilterChip>
            ))}
          </div>
        </div>
      ) : null}

      {/* Тип монтажа — chips */}
      {config.mount.length > 0 ? (
        <div style={groupStyle(config.outlet.length === 0)}>
          <h3 style={headingStyle}>{t("mountType")}</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {config.mount.map((v) => (
              <FilterChip key={v} href={toggleHref(base, params, "mount", v)} active={filters.mount.includes(v)}>
                {t(`mount.${v}`)}
              </FilterChip>
            ))}
          </div>
        </div>
      ) : null}

      {/* Коллекция */}
      <div style={groupStyle(config.outlet.length === 0 && config.mount.length === 0)}>
        <h3 style={headingStyle}>{t("collection")}</h3>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {config.collections.map((c) => (
            <CheckRow
              key={c}
              href={toggleHref(base, params, "collection", c)}
              checked={filters.collection.includes(c)}
              label={t(`collections.${c}`)}
              count={facetCount(items, filters, config, "collection", c)}
            />
          ))}
        </div>
      </div>

      {/* Цена — single select */}
      <div style={groupStyle(false)} role="radiogroup" aria-label={t("price")}>
        <h3 style={headingStyle}>{t("price")}</h3>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {config.price.map((b) => (
            <CheckRow
              key={b.id}
              kind="radio"
              href={priceHref(base, params, b.id)}
              checked={filters.price === b.id}
              label={t(`priceBuckets.${b.id}`)}
            />
          ))}
        </div>
      </div>

      {/* Отделка */}
      <div style={groupStyle(false)}>
        <h3 style={headingStyle}>{t("finish")}</h3>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {config.finishes.map((f) => (
            <CheckRow
              key={f}
              href={toggleHref(base, params, "finish", f)}
              checked={filters.finish.includes(f)}
              label={t(`finishes.${f}`)}
              count={facetCount(items, filters, config, "finish", f)}
            />
          ))}
        </div>
      </div>

      {/* Наличие */}
      <div style={groupStyle(false)}>
        <h3 style={headingStyle}>{t("stock")}</h3>
        <CheckRow href={stockHref(base, params)} checked={filters.inStockOnly} label={t("inStockOnly")} />
      </div>
    </div>
  );
}
