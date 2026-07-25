/* Proves the DB source returns the same catalog as the mock source.
   Run: pnpm db:parity   (requires DATABASE_URL and a seeded database)

   This is the gate before flipping CATALOG_SOURCE=db. Comparing the two
   sources field by field catches the failures that are invisible in a browser:
   a name that silently falls back to the handle, a dropped gallery photo, a
   stock state that defaults instead of loading. */

import { mockSource } from "../src/lib/repo/mock.source.ts";
import { dbSource } from "../src/lib/repo/db.source.ts";
import type { CatalogEntry } from "../src/lib/repo/types.ts";

const LOCALES = ["ru", "kk"] as const;

/* Fields that must match exactly. `gallery` is compared separately because
   ordering matters but the mock's Unsplash URLs are the same strings the seed
   inserted, so they are directly comparable. */
const FIELDS = [
  "handle",
  "sku",
  "category",
  "collection",
  "price",
  "oldPrice",
  "outletType",
  "mountType",
  "finish",
  "material",
  "stock",
  "badge",
  "installmentMonths",
  "name",
  "priceOnRequest",
] as const;

const problems: string[] = [];

function compare(label: string, a: CatalogEntry | null, b: CatalogEntry | null) {
  if (!a || !b) {
    problems.push(`${label}: present in ${a ? "mock" : "db"} only`);
    return;
  }
  for (const f of FIELDS) {
    const av = a[f] ?? null;
    const bv = b[f] ?? null;
    if (av !== bv) problems.push(`${label}.${f}: mock=${JSON.stringify(av)} db=${JSON.stringify(bv)}`);
  }
  const ag = a.gallery ?? [];
  const bg = b.gallery ?? [];
  if (ag.length !== bg.length) {
    problems.push(`${label}.gallery: mock has ${ag.length} photos, db has ${bg.length}`);
  }
  if ((a.image ?? null) !== (b.image ?? null)) {
    problems.push(`${label}.image: mock=${a.image ?? null} db=${b.image ?? null}`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const categories = await mockSource.listCategories();
  console.log(`→ comparing ${categories.length} categories × ${LOCALES.length} locales\n`);

  for (const locale of LOCALES) {
    for (const { slug } of categories) {
      const mockItems = await mockSource.listCategoryItems(slug, locale);
      const dbItems = await dbSource.listCategoryItems(slug, locale);

      if (mockItems.length !== dbItems.length) {
        problems.push(`[${locale}] ${slug}: mock returned ${mockItems.length} items, db returned ${dbItems.length}`);
      }

      const dbByHandle = new Map(dbItems.map((i) => [i.handle, i]));
      for (const m of mockItems) {
        compare(`[${locale}] ${slug}/${m.handle}`, m, dbByHandle.get(m.handle) ?? null);
      }

      // Filter facets drive the sidebar; a mismatch silently changes what a
      // customer can filter by.
      const mc = await mockSource.getFilterConfig(slug);
      const dc = await dbSource.getFilterConfig(slug);
      if (!dc) {
        problems.push(`[${locale}] ${slug}: db has no filter config`);
      } else if (mc) {
        for (const key of ["collections", "outlet", "mount", "finishes"] as const) {
          const a = [...mc[key]].sort().join(",");
          const b = [...dc[key]].sort().join(",");
          if (a !== b) problems.push(`[${locale}] ${slug}.filters.${key}: mock=[${a}] db=[${b}]`);
        }
      }
    }

    // Individual product lookups exercise the getItem path, which the category
    // listing does not.
    for (const handle of await mockSource.listHandles()) {
      compare(
        `[${locale}] product/${handle}`,
        await mockSource.getItem(handle, locale),
        await dbSource.getItem(handle, locale),
      );
    }
  }

  const mockHandles = (await mockSource.listHandles()).sort();
  const dbHandles = (await dbSource.listHandles()).sort();
  if (mockHandles.join() !== dbHandles.join()) {
    problems.push(`handle sets differ: mock=${mockHandles.length} db=${dbHandles.length}`);
  }

  if (problems.length) {
    console.error(`✗ ${problems.length} mismatch(es):\n`);
    for (const p of problems.slice(0, 60)) console.error(`   ${p}`);
    if (problems.length > 60) console.error(`   … and ${problems.length - 60} more`);
    process.exit(1);
  }

  console.log("✓ mock and db sources agree on every product, field and facet");
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ parity check failed:", err);
  process.exit(1);
});
