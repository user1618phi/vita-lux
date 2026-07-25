/* Seeds the database from the current mock catalog.
   Run: pnpm db:seed   (requires DATABASE_URL)

   Idempotent — safe to re-run. Taxonomy rows are upserted by their natural key,
   and a product is fully replaced (cascade) when its handle already exists, so
   re-seeding never accumulates duplicates.

   This exists so the DB source can be proven equivalent to the mock source
   before the storefront switches over. Real inventory is entered through the
   admin panel, not here. */

import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db/client.ts";
import { catalogItems } from "../src/data/catalog.ts";
import { homeCategories } from "../src/data/home.ts";

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
  setting,
} = schema;

const LOCALES = ["ru", "kk"] as const;

function namesFor(locale: string): Record<string, string> {
  const raw = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
  return raw?.Catalog?.names ?? {};
}

/* Defaults the storefront currently hardcodes. Moving them into `setting` is
   what lets the brother change a phone or a delivery threshold without a deploy.
   Values are the existing placeholders — real ones are entered in the admin. */
const SETTINGS: Record<string, unknown> = {
  "contact.phonePrimary": "77000000000",
  "contact.phoneSecondary": "",
  "contact.city": "",
  "contact.address": "",
  "delivery.freeFromKzt": 150000,
  "delivery.costKzt": 3900,
  "pricing.fxRateUsdKzt": 0,
  "pricing.defaultMarkupBp": 22000,
  "pricing.roundToKzt": 1000,
  "installment.months": 12,
  "installment.enabled": true,
};

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Point it at your Postgres instance and re-run.");
    process.exit(1);
  }

  const d = db();
  console.log("→ seeding taxonomy");

  // Brands: the whitelist from the official price list. Nothing else is allowed.
  const brandRows = [
    { code: "vita-lux", name: "Vita Lux", sort: 0 },
    { code: "smoow", name: "SMOOW", sort: 1 },
  ];
  const brandIds = new Map<string, string>();
  for (const b of brandRows) {
    const [row] = await d
      .insert(brand)
      .values(b)
      .onConflictDoUpdate({ target: brand.code, set: { name: b.name, sort: b.sort } })
      .returning({ id: brand.id, code: brand.code });
    brandIds.set(row.code, row.id);
  }

  // Categories, ordered as the header nav orders them.
  const categoryIds = new Map<string, string>();
  for (const [i, c] of homeCategories.entries()) {
    const [row] = await d
      .insert(category)
      .values({ slug: c.slug, sort: i, isActive: true })
      .onConflictDoUpdate({ target: category.slug, set: { sort: i, isActive: true } })
      .returning({ id: category.id, slug: category.slug });
    categoryIds.set(row.slug, row.id);
  }

  const collectionIds = new Map<string, string>();
  for (const [i, slug] of ["aura", "standart", "bronze"].entries()) {
    const [row] = await d
      .insert(collection)
      .values({ slug, sort: i })
      .onConflictDoUpdate({ target: collection.slug, set: { sort: i } })
      .returning({ id: collection.id, slug: collection.slug });
    collectionIds.set(row.slug, row.id);
  }

  console.log("→ seeding settings");
  for (const [key, value] of Object.entries(SETTINGS)) {
    await d
      .insert(setting)
      .values({ key, value })
      .onConflictDoNothing({ target: setting.key }); // never clobber edited settings
  }

  const names = Object.fromEntries(LOCALES.map((l) => [l, namesFor(l)])) as Record<string, Record<string, string>>;

  console.log(`→ seeding ${catalogItems.length} products`);
  let created = 0;

  for (const [i, item] of catalogItems.entries()) {
    const categoryId = categoryIds.get(item.category);
    if (!categoryId) throw new Error(`unknown category "${item.category}" on ${item.handle}`);
    const brandId = brandIds.get("vita-lux")!;

    // Replace an existing product wholesale: children cascade, so re-running
    // the seed converges instead of duplicating.
    await d.delete(product).where(eq(product.handle, item.handle));

    const [p] = await d
      .insert(product)
      .values({
        handle: item.handle,
        brandId,
        categoryId,
        collectionId: collectionIds.get(item.collection) ?? null,
        baseArticle: item.sku,
        status: "active",
        outletType: item.outletType ?? null,
        mountType: item.mountType ?? null,
        bodyMaterial: item.material ?? null,
        badge: item.badge ?? null,
        sortWeight: i,
        installmentMonths: item.installmentMonths,
      })
      .returning({ id: product.id });

    for (const locale of LOCALES) {
      await d.insert(productI18n).values({
        productId: p.id,
        locale,
        name: names[locale][item.handle] ?? item.handle,
      });
    }

    const [v] = await d
      .insert(variant)
      .values({
        productId: p.id,
        sku: item.sku,
        finish: item.finish,
        isDefault: true,
        status: "active",
        sort: 0,
      })
      .returning({ id: variant.id });

    // Mock prices are already retail tenge, entered by hand → mode "manual".
    await d.insert(price).values({
      variantId: v.id,
      retailKzt: item.price,
      oldKzt: item.oldPrice ?? null,
      mode: "manual",
    });

    await d.insert(inventory).values({ variantId: v.id, state: item.stock });

    const photos = item.gallery?.length ? item.gallery : item.image ? [item.image] : [];
    for (const [j, url] of photos.entries()) {
      await d.insert(media).values({
        productId: p.id,
        path: `mock/${item.handle}/${j}`,
        url,
        kind: "photo",
        sort: j,
      });
    }

    created += 1;
  }

  console.log(`✓ seeded ${created} products, ${brandRows.length} brands, ${categoryIds.size} categories`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ seed failed:", err);
  process.exit(1);
});
