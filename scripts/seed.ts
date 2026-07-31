/* Seeds the database from the current mock catalog.
   Run: pnpm db:seed   (requires DATABASE_URL)
   Флаги: --dry-run — только показать план; --force — перезаписать даже то, что
   правили в админке (уничтожает историю цен и загруженные фото).

   Idempotent — safe to re-run. Taxonomy rows are upserted by their natural key.
   Товар, у которого есть следы ручного редактирования, ПРОПУСКАЕТСЯ: см.
   touchedByHand ниже. Всё остальное пересоздаётся, поэтому повторный запуск
   сходится, а не плодит дубли.

   This exists so the DB source can be proven equivalent to the mock source
   before the storefront switches over. Real inventory is entered through the
   admin panel, not here. */

import { readFileSync } from "node:fs";
import { messagesDir } from "@vita/i18n/paths";
import { and, eq, isNotNull, like, not } from "drizzle-orm";
import { db, schema } from "@vita/db/client";
import { catalogItems } from "@vita/data/content/catalog";
import { homeCategories } from "@vita/data/content/home";

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
  auditLog,
} = schema;

const LOCALES = ["ru", "kk"] as const;

function namesFor(locale: string): Record<string, string> {
  // Путь берётся у @vita/i18n, а не собирается от этого файла: локали уже
  // переезжали, и относительные пути к ним ломались молча.
  const raw = JSON.parse(readFileSync(new URL(`${locale}.json`, messagesDir), "utf8"));
  return raw?.Catalog?.names ?? {};
}

/* Defaults the storefront currently hardcodes. Moving them into `setting` is
   what lets the brother change a phone or a delivery threshold without a deploy.
   Values are the existing placeholders — real ones are entered in the admin. */
const SETTINGS: Record<string, unknown> = {
  "contact.phonePrimary": "77079961717",
  "contact.phoneSecondary": "",
  "contact.city": "",
  "contact.address": "",
  "delivery.freeFromKzt": 150000,
  "delivery.costKzt": 3900,
  /* 24, а не 12: столько же несёт каждый товар в каталоге, и столько же стоит
     дефолтом в packages/data/src/settings.ts. С прежним значением карточка
     обещала бы рассрочку на 24 месяца, а блоки, читающие getSettings(), — на 12. */
  "installment.months": 24,
  "installment.enabled": true,
};

const FORCE = process.argv.includes("--force");
const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Есть ли следы ручного редактирования товара. Возвращает причину или null.
 *
 * Каждый признак выбран так, чтобы сид не мог создать его сам:
 *  - `media.path` вне префикса `mock/` — фото загружено через админку;
 *  - `price.createdBy` — сид цены не подписывает, админка подписывает всегда;
 *  - запись в `audit_log` по этому товару — прямое доказательство действия.
 */
async function touchedByHand(
  d: ReturnType<typeof db>,
  handle: string,
): Promise<string | null> {
  const [row] = await d.select({ id: product.id }).from(product).where(eq(product.handle, handle)).limit(1);
  if (!row) return null;

  const [photo] = await d
    .select({ path: media.path })
    .from(media)
    .where(and(eq(media.productId, row.id), not(like(media.path, "mock/%"))))
    .limit(1);
  if (photo) return "есть загруженное фото";

  const [manualPrice] = await d
    .select({ id: price.id })
    .from(price)
    .innerJoin(variant, eq(variant.id, price.variantId))
    .where(and(eq(variant.productId, row.id), isNotNull(price.createdBy)))
    .limit(1);
  if (manualPrice) return "цену меняли в админке";

  const [logged] = await d
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(and(eq(auditLog.entity, "product"), eq(auditLog.entityId, row.id)))
    .limit(1);
  if (logged) return "есть записи в журнале действий";

  return null;
}

/* Ключей pricing.fxRateUsdKzt / defaultMarkupBp / roundToKzt здесь больше нет.
   Их не было в KEYS (packages/data/src/settings.ts) — то есть их никто не
   читал, а автопересчёта цен в проекте не существует. Настройка, которая ничего
   не делает, хуже отсутствующей: владелец введёт курс доллара и будет ждать,
   что цены поедут. Появится пересчёт — заводить ключи вместе с читателем. */

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
  let skipped = 0;

  for (const [i, item] of catalogItems.entries()) {
    const categoryId = categoryIds.get(item.category);
    if (!categoryId) throw new Error(`unknown category "${item.category}" on ${item.handle}`);
    const brandId = brandIds.get("vita-lux")!;

    /* Не затирать то, что правили руками.

       Раньше здесь безусловно стоял `delete(product)`, а каскад уносил с собой
       ВСЮ историю цен, остатки и строки media — вместе с загруженными в
       админке фотографиями, объекты которых остаются висеть в бакете. Пока
       база была пустой песочницей, это было удобно. После того как админка
       уедет в прод, повторный запуск сида означал бы потерю реальной работы.

       Признак «товар трогали руками» — любой из трёх; каждый появляется только
       от действий администратора и никогда от сида. */
    const touched = await touchedByHand(d, item.handle);
    if (touched && !FORCE) {
      console.log(`  ⤳ пропуск ${item.handle}: ${touched}`);
      skipped += 1;
      continue;
    }
    if (DRY_RUN) {
      console.log(`  · ${item.handle}${touched ? ` (перезаписался бы: ${touched})` : ""}`);
      continue;
    }
    if (touched) console.log(`  ⚠ перезаписываю ${item.handle} (--force): ${touched}`);

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

  const tail = skipped ? `, пропущено (правили руками): ${skipped}` : "";
  console.log(
    DRY_RUN
      ? `✓ dry-run: изменений не внесено${tail}`
      : `✓ seeded ${created} products, ${brandRows.length} brands, ${categoryIds.size} categories${tail}`,
  );
  if (skipped && !FORCE) {
    console.log("  Чтобы перезаписать их, добавь --force. Это уничтожит историю цен и загруженные фото.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ seed failed:", err);
  process.exit(1);
});
