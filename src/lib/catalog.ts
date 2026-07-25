import type { StockState } from "@/components/ui/StockStatus";

/* Catalog domain: product attributes that drive filtering, plus pure
   filter/sort/href helpers shared by the server page, the desktop sidebar and
   the mobile filter sheet. No `brand`/`rating` fields — бренд всегда Vita Lux. */

export type OutletType = "horizontal" | "vertical" | "oblique";
export type MountType = "floor" | "wall";
export type SortKey = "popular" | "price-asc" | "price-desc" | "new";

export interface CatalogItem {
  handle: string;
  sku: string;
  category: string; // route category slug, e.g. "toilets"
  collection: string; // "aura" | "standart" | "bronze"
  price: number; // тенге, целое
  oldPrice?: number;
  outletType?: OutletType; // toilets only
  mountType?: MountType; // toilets / sinks / faucets where relevant
  finish: string; // finish key, localized via messages
  stock: StockState;
  badge?: "hit" | "sale" | "new";
  installmentMonths: number;
  image?: string; // primary photo (falls back to a branded placeholder)
  gallery?: string[]; // additional photos for the product page
  material?: string; // material key, localized via messages
}

/* Which filter facets a category exposes, and in which order. Ordered arrays so
   option order is deterministic across locales and matches the design. */
export interface PriceBucket {
  id: string;
  min: number;
  max: number | null; // null = no upper bound
}

export interface CategoryFilterConfig {
  collections: string[];
  outlet: OutletType[];
  mount: MountType[];
  finishes: string[];
  price: PriceBucket[];
}

/* ---- URL <-> filter state ------------------------------------------------ */

export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface ActiveFilters {
  collection: string[];
  outlet: string[];
  mount: string[];
  finish: string[];
  price: string | null; // single price bucket id
  inStockOnly: boolean;
  sort: SortKey;
}

const MULTI_KEYS = ["collection", "outlet", "mount", "finish"] as const;

function asList(v: string | string[] | undefined): string[] {
  if (!v) return [];
  const raw = Array.isArray(v) ? v.join(",") : v;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const SORT_KEYS: SortKey[] = ["popular", "price-asc", "price-desc", "new"];

export function parseFilters(params: RawSearchParams): ActiveFilters {
  const sortRaw = first(params.sort) as SortKey | undefined;
  return {
    collection: asList(params.collection),
    outlet: asList(params.outlet),
    mount: asList(params.mount),
    finish: asList(params.finish),
    price: first(params.price) ?? null,
    inStockOnly: first(params.stock) === "in",
    sort: sortRaw && SORT_KEYS.includes(sortRaw) ? sortRaw : "popular",
  };
}

/** Count of filter facets in play (excludes sort) — for the "Фильтры (N)" badge. */
export function activeFilterCount(f: ActiveFilters): number {
  return (
    f.collection.length +
    f.outlet.length +
    f.mount.length +
    f.finish.length +
    (f.price ? 1 : 0) +
    (f.inStockOnly ? 1 : 0)
  );
}

/* ---- href builders (server-rendered links, no client JS to filter) ------- */

function paramsToQuery(params: RawSearchParams): URLSearchParams {
  const q = new URLSearchParams();
  for (const key of [...MULTI_KEYS]) {
    const list = asList(params[key]);
    if (list.length) q.set(key, list.join(","));
  }
  const price = first(params.price);
  if (price) q.set("price", price);
  const stock = first(params.stock);
  if (stock) q.set("stock", stock);
  const sort = first(params.sort);
  if (sort) q.set("sort", sort);
  return q;
}

function withQuery(base: string, q: URLSearchParams): string {
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

/** Toggle one value inside a multi-select facet (collection/outlet/mount/finish). */
export function toggleHref(
  base: string,
  params: RawSearchParams,
  key: (typeof MULTI_KEYS)[number],
  value: string,
): string {
  const q = paramsToQuery(params);
  const current = asList(params[key]);
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
  if (next.length) q.set(key, next.join(","));
  else q.delete(key);
  return withQuery(base, q);
}

/** Toggle a single-select price bucket (selecting the active one clears it). */
export function priceHref(base: string, params: RawSearchParams, bucketId: string): string {
  const q = paramsToQuery(params);
  if (first(params.price) === bucketId) q.delete("price");
  else q.set("price", bucketId);
  return withQuery(base, q);
}

/** Toggle the "только в наличии" flag. */
export function stockHref(base: string, params: RawSearchParams): string {
  const q = paramsToQuery(params);
  if (first(params.stock) === "in") q.delete("stock");
  else q.set("stock", "in");
  return withQuery(base, q);
}

/** Set the sort order, preserving all filters. */
export function sortHref(base: string, params: RawSearchParams, sort: SortKey): string {
  const q = paramsToQuery(params);
  if (sort === "popular") q.delete("sort");
  else q.set("sort", sort);
  return withQuery(base, q);
}

/** Drop every filter (keeps sort). */
export function clearFiltersHref(base: string, params: RawSearchParams): string {
  const q = new URLSearchParams();
  const sort = first(params.sort);
  if (sort) q.set("sort", sort);
  return withQuery(base, q);
}

/* ---- filtering & sorting (pure) ------------------------------------------ */

function matchesBucket(price: number, bucket: PriceBucket): boolean {
  return price >= bucket.min && (bucket.max === null || price < bucket.max);
}

function applyFilters<T extends CatalogItem>(
  items: T[],
  f: ActiveFilters,
  config: CategoryFilterConfig,
  opts: { ignore?: keyof ActiveFilters } = {},
): T[] {
  const { ignore } = opts;
  const bucket = f.price ? config.price.find((b) => b.id === f.price) : undefined;
  return items.filter((it) => {
    if (ignore !== "collection" && f.collection.length && !f.collection.includes(it.collection)) return false;
    if (ignore !== "outlet" && f.outlet.length && !(it.outletType && f.outlet.includes(it.outletType))) return false;
    if (ignore !== "mount" && f.mount.length && !(it.mountType && f.mount.includes(it.mountType))) return false;
    if (ignore !== "finish" && f.finish.length && !f.finish.includes(it.finish)) return false;
    if (ignore !== "price" && bucket && !matchesBucket(it.price, bucket)) return false;
    if (ignore !== "inStockOnly" && f.inStockOnly && it.stock !== "in") return false;
    return true;
  });
}

const BADGE_RANK: Record<string, number> = { hit: 0, new: 1, sale: 2 };

export function filterAndSort<T extends CatalogItem>(
  items: T[],
  f: ActiveFilters,
  config: CategoryFilterConfig,
): T[] {
  const result = applyFilters(items, f, config);
  const sorted = [...result];
  switch (f.sort) {
    case "price-asc":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      sorted.sort((a, b) => b.price - a.price);
      break;
    case "new":
      sorted.sort((a, b) => Number(b.badge === "new") - Number(a.badge === "new"));
      break;
    default:
      // popular: in-stock first, then badge priority, then price.
      sorted.sort((a, b) => {
        const stock = Number(b.stock === "in") - Number(a.stock === "in");
        if (stock) return stock;
        const badge = (BADGE_RANK[a.badge ?? ""] ?? 9) - (BADGE_RANK[b.badge ?? ""] ?? 9);
        if (badge) return badge;
        return a.price - b.price;
      });
  }
  return sorted;
}

/** Facet count: how many items match if this option were added to the current
    selection — but the option's own group is ignored so counts don't collapse
    to zero as you tick boxes within one group. */
export function facetCount<T extends CatalogItem>(
  items: T[],
  f: ActiveFilters,
  config: CategoryFilterConfig,
  group: "collection" | "outlet" | "mount" | "finish",
  value: string,
): number {
  const base = applyFilters(items, f, config, { ignore: group });
  const pred: Record<typeof group, (it: CatalogItem) => boolean> = {
    collection: (it) => it.collection === value,
    outlet: (it) => it.outletType === value,
    mount: (it) => it.mountType === value,
    finish: (it) => it.finish === value,
  };
  return base.filter(pred[group]).length;
}
