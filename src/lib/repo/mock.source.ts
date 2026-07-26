import { catalogItems, categoryFilters, getCatalogItem, getCategoryItems } from "@/data/catalog";
import { facetPolicy, type CatalogItem, type CategoryFilterConfig } from "@/lib/catalog";
import type { CatalogEntry, CatalogSource, CategorySummary, ResolvedLine } from "./types";

/* Mock catalog source: today's hardcoded inventory in src/data/catalog.ts, with
   names pulled out of the i18n catalogs. Kept alive after the DB lands so that
   `pnpm dev` and CI work without a database. */

type MessageFile = { Catalog?: { names?: Record<string, string> } };

const nameCache = new Map<string, Record<string, string>>();

async function namesFor(locale: string): Promise<Record<string, string>> {
  const cached = nameCache.get(locale);
  if (cached) return cached;
  try {
    const mod = (await import(`../../../messages/${locale}.json`)) as { default: MessageFile };
    const names = mod.default.Catalog?.names ?? {};
    nameCache.set(locale, names);
    return names;
  } catch {
    return {};
  }
}

function toEntry(item: CatalogItem, names: Record<string, string>): CatalogEntry {
  return {
    ...item,
    name: names[item.handle] ?? item.handle,
    priceOnRequest: false,
    brandCode: "vita-lux",
  };
}

async function decorate(items: CatalogItem[], locale: string): Promise<CatalogEntry[]> {
  const names = await namesFor(locale);
  return items.map((it) => toEntry(it, names));
}

export const mockSource: CatalogSource = {
  async listCategoryItems(category, locale) {
    return decorate(getCategoryItems(category), locale);
  },

  async getItem(handle, locale) {
    const item = getCatalogItem(handle);
    if (!item) return null;
    const names = await namesFor(locale);
    return toEntry(item, names);
  },

  async listHandles() {
    return catalogItems.map((it) => it.handle);
  },

  async listCategories(): Promise<CategorySummary[]> {
    return Object.keys(categoryFilters).map((slug) => ({
      slug,
      itemCount: getCategoryItems(slug).length,
    }));
  },

  async getFilterConfig(category): Promise<CategoryFilterConfig | null> {
    const config = categoryFilters[category];
    if (!config) return null;

    /* Narrow the declared facets to what the category actually stocks. The
       static config lists every collection for every category, which offered
       filters that could only ever return nothing. */
    const items = getCategoryItems(category);
    const present = <T>(values: T[], pick: (it: CatalogItem) => T | undefined) =>
      values.filter((v) => items.some((it) => pick(it) === v));
    const policy = facetPolicy(category);

    return {
      ...config,
      collections: present(config.collections, (it) => it.collection),
      finishes: present(config.finishes, (it) => it.finish),
      outlet: policy.outlet ? present(config.outlet, (it) => it.outletType) : [],
      mount: policy.mount ? present(config.mount, (it) => it.mountType) : [],
    };
  },

  async getHomeHits(locale, count) {
    const featured = catalogItems.filter((it) => it.badge === "hit" || it.badge === "new");
    const rest = catalogItems.filter((it) => !featured.includes(it) && it.stock === "in");
    return decorate([...featured, ...rest].slice(0, count), locale);
  },

  async resolveLines(lines, locale): Promise<ResolvedLine[]> {
    const names = await namesFor(locale);
    return lines
      .map(({ handle, qty }) => {
        const item = getCatalogItem(handle);
        return item ? { item: toEntry(item, names), qty } : null;
      })
      .filter((l): l is ResolvedLine => l !== null);
  },
};
