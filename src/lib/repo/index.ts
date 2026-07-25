import { unstable_cache } from "next/cache";
import { mockSource } from "./mock.source";
import type { CatalogEntry, CatalogSource, CategorySummary, ResolvedLine } from "./types";

/* Catalog repository — the single seam between pages and wherever product data
   actually lives. Pages import from here and nowhere else.

   Server-only. Importing this from a Client Component would pull the whole
   catalog (and, once db.source lands, the database driver) into the browser
   bundle. Replace this guard with `import "server-only"` when that package is
   installed alongside the Drizzle batch. */
if (typeof window !== "undefined") {
  throw new Error("@/lib/repo is server-only and must not be imported from a Client Component");
}

export type { CatalogEntry, CategorySummary, ResolvedLine } from "./types";

/** Cache tags. Every admin mutation must revalidate the matching tag. */
export const CATALOG_TAG = "catalog";
export const productTag = (handle: string) => `product:${handle}`;

function pickSource(): CatalogSource {
  // "db" is wired in A2; mock stays the default so `pnpm dev` and CI need no database.
  return mockSource;
}

const source = pickSource();

export const listCategoryItems = unstable_cache(
  (category: string, locale: string): Promise<CatalogEntry[]> => source.listCategoryItems(category, locale),
  ["catalog:category"],
  { tags: [CATALOG_TAG] },
);

export const getItem = unstable_cache(
  (handle: string, locale: string): Promise<CatalogEntry | null> => source.getItem(handle, locale),
  ["catalog:item"],
  { tags: [CATALOG_TAG] },
);

export const listHandles = unstable_cache(
  (): Promise<string[]> => source.listHandles(),
  ["catalog:handles"],
  { tags: [CATALOG_TAG] },
);

export const listCategories = unstable_cache(
  (): Promise<CategorySummary[]> => source.listCategories(),
  ["catalog:categories"],
  { tags: [CATALOG_TAG] },
);

export const getFilterConfig = unstable_cache(
  (category: string) => source.getFilterConfig(category),
  ["catalog:filter-config"],
  { tags: [CATALOG_TAG] },
);

export const getHomeHits = unstable_cache(
  (locale: string, count = 8): Promise<CatalogEntry[]> => source.getHomeHits(locale, count),
  ["catalog:home-hits"],
  { tags: [CATALOG_TAG] },
);

/** Cart lines joined against the catalog. Not cached — reflects live stock/price. */
export function resolveLines(
  lines: { handle: string; qty: number }[],
  locale: string,
): Promise<ResolvedLine[]> {
  return source.resolveLines(lines, locale);
}
