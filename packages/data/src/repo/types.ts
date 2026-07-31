import type { CatalogItem, CategoryFilterConfig } from "@vita/core/catalog";

/* Read model returned by the catalog repository.

   The important difference from `CatalogItem`: `name` is already resolved for
   the requested locale. Pages must never look a name up themselves — today the
   mock source reads it from messages/*.json, tomorrow the DB source reads it
   from `product_i18n`, and no page changes. */

export interface CatalogEntry extends CatalogItem {
  /** Product name, already localized. Never a raw handle. */
  name: string;
  /** No price is published — render "Цена по запросу", disallow adding to cart. */
  priceOnRequest: boolean;
  /** Brand code, e.g. "vita-lux" | "smoow". Absent on mock data. */
  brandCode?: string;
}

export interface CategorySummary {
  slug: string;
  itemCount: number;
}

/** A cart line joined against the catalog, resolved server-side. */
export interface ResolvedLine {
  item: CatalogEntry;
  qty: number;
}

/** Everything a catalog source must implement. Mock and DB both satisfy this. */
export interface CatalogSource {
  listCategoryItems(category: string, locale: string): Promise<CatalogEntry[]>;
  getItem(handle: string, locale: string): Promise<CatalogEntry | null>;
  listHandles(): Promise<string[]>;
  listCategories(): Promise<CategorySummary[]>;
  getFilterConfig(category: string): Promise<CategoryFilterConfig | null>;
  getHomeHits(locale: string, count: number): Promise<CatalogEntry[]>;
  resolveLines(handles: { handle: string; qty: number }[], locale: string): Promise<ResolvedLine[]>;
}
