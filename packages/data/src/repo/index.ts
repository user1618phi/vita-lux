import "server-only";
import { unstable_cache } from "next/cache";
import { mockSource } from "./mock.source";
import { dbSource } from "./db.source";
import type { CatalogEntry, CatalogSource, CategorySummary, ResolvedLine } from "./types";

/* Catalog repository — the single seam between pages and wherever product data
   actually lives. Pages import from here and nowhere else.

   `server-only` matters here: importing this from a Client Component would pull
   the whole catalog and the Postgres driver into the browser bundle. */

export type { CatalogEntry, CategorySummary, ResolvedLine } from "./types";

/** Cache tags. Every admin mutation must revalidate the matching tag. */
export const CATALOG_TAG = "catalog";
export const productTag = (handle: string) => `product:${handle}`;

/* Source selection. `mock` stays the default so `pnpm dev` and CI work with no
   database; set CATALOG_SOURCE=db once the schema is migrated and seeded. */
function pickSource(): CatalogSource {
  if (process.env.CATALOG_SOURCE === "db") {
    if (!process.env.DATABASE_URL) {
      throw new Error("CATALOG_SOURCE=db requires DATABASE_URL to be set.");
    }
    return dbSource;
  }
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
