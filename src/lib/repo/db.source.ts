import "server-only";
import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { CatalogItem, CategoryFilterConfig, OutletType, MountType, PriceBucket } from "@/lib/catalog";
import type { StockState } from "@/components/ui/StockStatus";
import type { CatalogEntry, CatalogSource, CategorySummary, ResolvedLine } from "./types";

/* Postgres-backed catalog source.

   Shape note: the storefront filters in memory over `CatalogEntry[]` — at this
   catalogue size the whole active inventory is tens of kilobytes, and keeping
   it in memory is what preserves `facetCount`'s "ignore the option's own group"
   semantics without a query per facet. So these queries fetch a category, not
   a filtered page. */

const {
  brand,
  category,
  collection,
  product,
  productI18n,
  variant,
  price,
  inventory,
  media,
} = schema;

/** Price rows are append-only; the newest row whose window covers now() wins. */
const priceIsCurrent = and(
  sql`${price.validFrom} <= now()`,
  or(isNull(price.validTo), sql`${price.validTo} > now()`),
);

type Row = {
  handle: string;
  categorySlug: string;
  collectionSlug: string | null;
  brandCode: string;
  badge: "hit" | "sale" | "new" | null;
  outletType: OutletType | null;
  mountType: MountType | null;
  bodyMaterial: string | null;
  installmentMonths: number;
  sortWeight: number;
  name: string | null;
  sku: string | null;
  finish: string | null;
  retailKzt: number | null;
  oldKzt: number | null;
  stock: StockState | null;
  image: string | null;
};

function toEntry(row: Row, gallery: string[]): CatalogEntry {
  const priceOnRequest = row.retailKzt === null;
  return {
    handle: row.handle,
    sku: row.sku ?? row.handle.toUpperCase(),
    category: row.categorySlug,
    collection: row.collectionSlug ?? "",
    price: row.retailKzt ?? 0,
    oldPrice: row.oldKzt ?? undefined,
    outletType: row.outletType ?? undefined,
    mountType: row.mountType ?? undefined,
    finish: row.finish ?? "",
    material: row.bodyMaterial ?? undefined,
    stock: row.stock ?? "order",
    badge: row.badge ?? undefined,
    installmentMonths: row.installmentMonths,
    image: row.image ?? undefined,
    gallery: gallery.length ? gallery : undefined,
    name: row.name ?? row.handle,
    priceOnRequest,
    brandCode: row.brandCode,
  } satisfies CatalogEntry & CatalogItem;
}

/** One product row joined with its default variant, current price, stock and cover. */
function baseQuery(locale: string) {
  return db()
    .select({
      handle: product.handle,
      categorySlug: category.slug,
      collectionSlug: collection.slug,
      brandCode: brand.code,
      badge: product.badge,
      outletType: product.outletType,
      mountType: product.mountType,
      bodyMaterial: product.bodyMaterial,
      installmentMonths: product.installmentMonths,
      sortWeight: product.sortWeight,
      name: productI18n.name,
      sku: variant.sku,
      finish: variant.finish,
      retailKzt: price.retailKzt,
      oldKzt: price.oldKzt,
      stock: inventory.state,
      image: media.url,
      productId: product.id,
    })
    .from(product)
    .innerJoin(category, eq(category.id, product.categoryId))
    .innerJoin(brand, eq(brand.id, product.brandId))
    .leftJoin(collection, eq(collection.id, product.collectionId))
    .leftJoin(productI18n, and(eq(productI18n.productId, product.id), eq(productI18n.locale, locale)))
    .leftJoin(variant, and(eq(variant.productId, product.id), eq(variant.isDefault, true)))
    .leftJoin(price, and(eq(price.variantId, variant.id), priceIsCurrent))
    .leftJoin(inventory, eq(inventory.variantId, variant.id))
    .leftJoin(media, and(eq(media.productId, product.id), eq(media.sort, 0)));
}

/** Galleries for a set of products, ordered, keyed by product id. */
async function galleriesFor(productIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!productIds.length) return out;
  const rows = await db()
    .select({ productId: media.productId, url: media.url })
    .from(media)
    .where(and(inArray(media.productId, productIds), eq(media.kind, "photo")))
    .orderBy(asc(media.sort));
  for (const r of rows) {
    const list = out.get(r.productId) ?? [];
    list.push(r.url);
    out.set(r.productId, list);
  }
  return out;
}

async function decorate(rows: (Row & { productId: string })[]): Promise<CatalogEntry[]> {
  const galleries = await galleriesFor(rows.map((r) => r.productId));
  return rows.map((r) => toEntry(r, galleries.get(r.productId) ?? []));
}

/* Facet configuration is derived from what the category actually contains, so
   a filter group never offers an option that yields zero results. */
const PRICE_BUCKETS: PriceBucket[] = [
  { id: "0-80000", min: 0, max: 80000 },
  { id: "80000-150000", min: 80000, max: 150000 },
  { id: "150000-260000", min: 150000, max: 260000 },
  { id: "260000", min: 260000, max: null },
];

export const dbSource: CatalogSource = {
  async listCategoryItems(categorySlug, locale) {
    const rows = await baseQuery(locale)
      .where(and(eq(category.slug, categorySlug), eq(product.status, "active")))
      .orderBy(asc(product.sortWeight));
    return decorate(rows as (Row & { productId: string })[]);
  },

  async getItem(handle, locale) {
    const rows = await baseQuery(locale)
      .where(and(eq(product.handle, handle), eq(product.status, "active")))
      .limit(1);
    if (!rows.length) return null;
    const [entry] = await decorate(rows as (Row & { productId: string })[]);
    return entry ?? null;
  },

  async listHandles() {
    const rows = await db()
      .select({ handle: product.handle })
      .from(product)
      .where(eq(product.status, "active"));
    return rows.map((r) => r.handle);
  },

  async listCategories(): Promise<CategorySummary[]> {
    const rows = await db()
      .select({ slug: category.slug, itemCount: sql<number>`count(${product.id})::int` })
      .from(category)
      .leftJoin(product, and(eq(product.categoryId, category.id), eq(product.status, "active")))
      .where(eq(category.isActive, true))
      .groupBy(category.slug, category.sort)
      .orderBy(asc(category.sort));
    return rows;
  },

  async getFilterConfig(categorySlug): Promise<CategoryFilterConfig | null> {
    const rows = await db()
      .select({
        collectionSlug: collection.slug,
        outletType: product.outletType,
        mountType: product.mountType,
        finish: variant.finish,
      })
      .from(product)
      .innerJoin(category, eq(category.id, product.categoryId))
      .leftJoin(collection, eq(collection.id, product.collectionId))
      .leftJoin(variant, and(eq(variant.productId, product.id), eq(variant.isDefault, true)))
      .where(and(eq(category.slug, categorySlug), eq(product.status, "active")));

    if (!rows.length) {
      // Distinguish "category exists but is empty" from "no such category" —
      // the page 404s only on the latter.
      const exists = await db()
        .select({ slug: category.slug })
        .from(category)
        .where(eq(category.slug, categorySlug))
        .limit(1);
      if (!exists.length) return null;
    }

    const uniq = <T>(xs: (T | null | undefined)[]): T[] => [...new Set(xs.filter((x): x is T => x != null))];

    return {
      collections: uniq(rows.map((r) => r.collectionSlug)),
      outlet: uniq(rows.map((r) => r.outletType)) as OutletType[],
      mount: uniq(rows.map((r) => r.mountType)) as MountType[],
      finishes: uniq(rows.map((r) => r.finish)),
      price: PRICE_BUCKETS,
    };
  },

  async getHomeHits(locale, count) {
    const rows = await baseQuery(locale)
      .where(eq(product.status, "active"))
      .orderBy(sql`(${product.badge} is null), ${product.sortWeight}`)
      .limit(count);
    return decorate(rows as (Row & { productId: string })[]);
  },

  async resolveLines(lines, locale): Promise<ResolvedLine[]> {
    if (!lines.length) return [];
    const rows = await baseQuery(locale).where(
      and(
        inArray(
          product.handle,
          lines.map((l) => l.handle),
        ),
        eq(product.status, "active"),
      ),
    );
    const entries = await decorate(rows as (Row & { productId: string })[]);
    const byHandle = new Map(entries.map((e) => [e.handle, e]));
    return lines
      .map(({ handle, qty }) => {
        const item = byHandle.get(handle);
        return item ? { item, qty } : null;
      })
      .filter((l): l is ResolvedLine => l !== null);
  },
};
