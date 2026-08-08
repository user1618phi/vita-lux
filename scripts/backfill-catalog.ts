/* Наполнение каталога: названия, разделы, характеристики и описания.

   Запуск:
     pnpm db:backfill -- --dry-run             показать, что изменится
     pnpm db:backfill                          записать контент (статус не трогает)
     pnpm db:backfill -- --dry-run --activate  показать, кого включит
     pnpm db:backfill -- --activate --limit=5  включить первые пять
     pnpm db:backfill -- --retire-mock         увести макетные товары в черновики

   ЦЕНЫ НЕ ПИШУТСЯ. Ни вставкой, ни обновлением, ни закрытием строки. Из схемы
   импортируются только те таблицы, что нужны, — `price` в область видимости не
   попадает вовсе, чтобы это нельзя было сделать по невнимательности.

   Причина в CLAUDE.md: пока действует строка `mode: "manual"`, синхронизация
   цену НЕ ТРОГАЕТ. То есть одна лишняя вставка навсегда отвязала бы товар от
   цен X2pos, и заметили бы это через недели — когда цена на сайте перестала бы
   обновляться. Соблазн реальный: очевидная ленивая реализация — переиспользовать
   `saveProductAction` из админки, а она пишет строку цены при каждом сохранении.

   Остатки (`inventory`) и фото (`media`) тоже не наши: ими владеет X2pos. */

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@vita/db/client";
import { checksFor, publishable, INBOX_SLUG } from "@vita/core/readiness";
import { CATALOG_SLUGS } from "@vita/data/content/nav";
import { catalogItems } from "@vita/data/content/catalog";
import { messagesDir } from "@vita/i18n/paths";
import { readFileSync } from "node:fs";
import { rows, type BackfillRow } from "./data/backfill-rows.ts";

const { product, productI18n, variant, category, media, inventory } = schema;

const argv = process.argv.slice(2);
const has = (flag: string) => argv.includes(flag);
const DRY_RUN = has("--dry-run");
const ACTIVATE = has("--activate");
const RETIRE_MOCK = has("--retire-mock");
const LIMIT = Number(argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 0) || 0;
const ONLY = argv.find((a) => a.startsWith("--only="))?.split("=")[1];

interface Report {
  updated: string[];
  unchanged: string[];
  activated: string[];
  notReady: { article: string; missing: string[] }[];
  ambiguous: string[];
  missing: string[];
  retired: string[];
  newCategories: string[];
  errors: string[];
}

const report: Report = {
  updated: [],
  unchanged: [],
  activated: [],
  notReady: [],
  ambiguous: [],
  missing: [],
  retired: [],
  newCategories: [],
  errors: [],
};

/* --- Проверка словарей ----------------------------------------------------
   Отделка, материал и коллекция резолвятся через ключи локали. Значение без
   ключа печатается на витрине как «Filters.finishes.duroplast» — прямо в
   таблице характеристик. Ловим это до записи, а не глазами после. */

function loadFinishKeys(): Set<string> {
  const raw = readFileSync(new URL("ru.json", messagesDir), "utf8");
  const data = JSON.parse(raw) as { Filters?: { finishes?: Record<string, string> } };
  return new Set(Object.keys(data.Filters?.finishes ?? {}));
}

function validate(list: BackfillRow[], finishKeys: Set<string>): string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();

  for (const r of list) {
    if (r.finish && !finishKeys.has(r.finish)) {
      problems.push(`${r.article}: отделка «${r.finish}» отсутствует в Filters.finishes`);
    }
    if (!CATALOG_SLUGS.includes(r.category)) {
      problems.push(`${r.article}: неизвестный раздел «${r.category}»`);
    }
    if (!r.nameRu.trim() || !r.nameKk.trim()) {
      problems.push(`${r.article}: пустое название`);
    }
    // Имя, совпадающее с артикулом, админка считает заглушкой синка.
    if (r.nameRu.trim().toLowerCase() === r.article.trim().toLowerCase()) {
      problems.push(`${r.article}: название совпадает с артикулом`);
    }
    const dup = seen.get(r.externalId);
    if (dup) problems.push(`external_id ${r.externalId} встречается дважды: ${dup} и ${r.article}`);
    seen.set(r.externalId, r.article);
  }
  return problems;
}

/* --- Разделы --------------------------------------------------------------
   Своя функция, а не `pnpm db:seed`: на боевой базе сид запускать нельзя, он
   пересоздаёт макетные товары. Порядок сортировки — индекс в CATALOG_SLUGS,
   он же порядок разделов на витрине. */

/** Заглушка для сухого прогона: раздела ещё нет, но записывать мы и не будем. */
const PENDING_CATEGORY = "(будет создан)";

async function ensureCategories(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const [i, slug] of CATALOG_SLUGS.entries()) {
    if (DRY_RUN) {
      const [existing] = await db().select({ id: category.id }).from(category).where(eq(category.slug, slug)).limit(1);
      /* Без заглушки сухой прогон объявлял бы ошибкой каждый товар нового
         раздела — то есть показывал бы катастрофу там, где всё в порядке, и
         пользоваться им было бы нельзя. */
      ids.set(slug, existing?.id ?? PENDING_CATEGORY);
      if (!existing) report.newCategories.push(slug);
      continue;
    }
    const [row] = await db()
      .insert(category)
      .values({ slug, sort: i, isActive: true })
      .onConflictDoUpdate({ target: category.slug, set: { sort: i, isActive: true } })
      .returning({ id: category.id });
    ids.set(slug, row.id);
  }
  return ids;
}

/* --- Поиск товара ---------------------------------------------------------
   CLAUDE.md прямо предупреждает: артикулы НЕ уникальны (VL-6109 и VL-6119
   встречаются дважды). Поэтому ключ поиска — `external_id`, единственный
   по-настоящему уникальный, а артикул остаётся запасным вариантом. Если по
   артикулу нашлось больше одной строки, строка пропускается: записать чужое
   название на чужой товар — ошибка, которая ничего не ломает и потому не
   обнаруживается. */

async function resolveProduct(r: BackfillRow): Promise<string | null> {
  const byExternal = await db()
    .select({ id: product.id })
    .from(product)
    .where(and(eq(product.externalId, r.externalId), eq(product.externalSource, "x2pos")))
    .limit(2);
  if (byExternal.length === 1) return byExternal[0].id;

  const byArticle = await db()
    .select({ id: product.id })
    .from(product)
    .where(eq(product.baseArticle, r.article))
    .limit(2);
  if (byArticle.length === 1) return byArticle[0].id;
  if (byArticle.length > 1) {
    report.ambiguous.push(r.article);
    return null;
  }
  report.missing.push(`${r.article} (external_id ${r.externalId})`);
  return null;
}

/* --- Запись --------------------------------------------------------------- */

async function applyRow(r: BackfillRow, categoryIds: Map<string, string>): Promise<void> {
  const id = await resolveProduct(r);
  if (!id) return;

  const categoryId = categoryIds.get(r.category);
  if (!categoryId) {
    report.errors.push(`${r.article}: раздел ${r.category} отсутствует в базе`);
    return;
  }

  const [current] = await db()
    .select({
      categoryId: product.categoryId,
      outletType: product.outletType,
      mountType: product.mountType,
      flushType: product.flushType,
      seatMaterial: product.seatMaterial,
      widthMm: product.widthMm,
      depthMm: product.depthMm,
      heightMm: product.heightMm,
    })
    .from(product)
    .where(eq(product.id, id))
    .limit(1);

  const next = {
    categoryId,
    outletType: r.outletType ?? null,
    mountType: r.mountType ?? null,
    flushType: r.flushType ?? null,
    seatMaterial: r.seatMaterial ?? null,
    widthMm: r.widthMm ?? null,
    depthMm: r.depthMm ?? null,
    heightMm: r.heightMm ?? null,
  };

  const [ru] = await db()
    .select({ name: productI18n.name, description: productI18n.descriptionMd })
    .from(productI18n)
    .where(and(eq(productI18n.productId, id), eq(productI18n.locale, "ru")))
    .limit(1);

  /* Всё пишется из файла, никогда из текущего состояния базы, — иначе повторный
     прогон давал бы другой результат. Diff нужен только чтобы не трогать строки
     зря и чтобы --dry-run показывал настоящие изменения, а не список пустышек. */
  const productChanged =
    !current ||
    (Object.keys(next) as (keyof typeof next)[]).some((k) => current[k] !== next[k]);
  const i18nChanged = !ru || ru.name !== r.nameRu || ru.description !== r.descriptionRu;

  if (!productChanged && !i18nChanged) {
    report.unchanged.push(r.article);
    return;
  }
  report.updated.push(r.article);
  if (DRY_RUN) return;

  await db().update(product).set({ ...next, updatedAt: new Date() }).where(eq(product.id, id));

  for (const [locale, name, description] of [
    ["ru", r.nameRu, r.descriptionRu],
    ["kk", r.nameKk, r.descriptionKk],
  ] as const) {
    /* SEO-поля не заполняем: generateMetadata собирает заголовок из названия, а
       описание — из первых строк описания товара. Дублировать это в базу значит
       завести второй источник правды, который начнёт расходиться. */
    await db()
      .insert(productI18n)
      .values({ productId: id, locale, name, descriptionMd: description })
      .onConflictDoUpdate({
        target: [productI18n.productId, productI18n.locale],
        set: { name, descriptionMd: description },
      });
  }

  if (r.finish) {
    await db()
      .update(variant)
      .set({ finish: r.finish })
      .where(and(eq(variant.productId, id), eq(variant.isDefault, true)));
  }
}

/* --- Публикация -----------------------------------------------------------
   Правила готовности общие с админкой (@vita/core/readiness): имя, раздел,
   фото и цена. Товар без фотографии или без цены на витрину не выйдет, сколько
   бы контента мы ему ни написали, — и это правильно. */

async function activate(): Promise<void> {
  const candidates = await db()
    .select({
      id: product.id,
      article: product.baseArticle,
      handle: product.handle,
      name: productI18n.name,
      sku: variant.sku,
      categorySlug: category.slug,
      qty: inventory.qty,
      photos: sql<number>`(select count(*)::int from ${media} m where m.product_id = ${product.id})`,
      retailKzt: sql<number | null>`(
        select p.retail_kzt from price p
        join variant v on v.id = p.variant_id
        where v.product_id = ${product.id} and v.is_default and p.valid_to is null
        order by p.valid_from desc limit 1
      )`,
    })
    .from(product)
    .innerJoin(category, eq(category.id, product.categoryId))
    .leftJoin(productI18n, and(eq(productI18n.productId, product.id), eq(productI18n.locale, "ru")))
    .leftJoin(variant, and(eq(variant.productId, product.id), eq(variant.isDefault, true)))
    .leftJoin(inventory, eq(inventory.variantId, variant.id))
    .where(and(eq(product.externalSource, "x2pos"), eq(product.status, "draft")));

  const ready: string[] = [];
  for (const c of candidates) {
    const checks = checksFor({
      name: c.name ?? "",
      sku: c.sku ?? c.article,
      categorySlug: c.categorySlug,
      retailKzt: c.retailKzt,
      qty: c.qty,
      photos: Number(c.photos),
    });
    if (publishable(checks)) {
      ready.push(c.id);
      report.activated.push(c.article ?? c.handle);
    } else {
      const missing = Object.entries(checks)
        .filter(([k, ok]) => !ok && k !== "stock")
        .map(([k]) => k);
      if (missing.length) report.notReady.push({ article: c.article ?? c.handle, missing });
    }
  }

  const batch = LIMIT ? ready.slice(0, LIMIT) : ready;
  report.activated = report.activated.slice(0, batch.length);
  if (!DRY_RUN && batch.length) {
    await db().update(product).set({ status: "active", updatedAt: new Date() }).where(inArray(product.id, batch));
  }
}

/* --- Уход макетных товаров ------------------------------------------------
   Список хендлов берётся из модуля, который их и определяет, поэтому разъехаться
   он не может. Предикат `external_source is null` был бы короче и неверен: под
   него попадают и товары, заведённые руками в админке.

   Черновик, а не архив: макетные товары никуда не делись, их просто не должно
   быть видно. `archived` в этом коде — слово синхронизации, оно означает
   «удалён в X2pos». */

async function retireMock(): Promise<void> {
  const handles = catalogItems.map((i) => i.handle);
  const found = await db()
    .select({ id: product.id, handle: product.handle })
    .from(product)
    .where(and(inArray(product.handle, handles), eq(product.status, "active"), isNull(product.externalSource)));

  report.retired = found.map((f) => f.handle);
  if (!DRY_RUN && found.length) {
    await db()
      .update(product)
      .set({ status: "draft", updatedAt: new Date() })
      .where(inArray(product.id, found.map((f) => f.id)));
  }
}

/* --- Вывод ---------------------------------------------------------------- */

function print(): boolean {
  const line = (label: string, items: string[]) => {
    if (!items.length) return;
    console.log(`\n${label} (${items.length}):`);
    console.log(`   ${items.join(", ")}`);
  };

  console.log(`\n${DRY_RUN ? "СУХОЙ ПРОГОН — в базу ничего не записано" : "Записано в базу"}`);
  console.log(`   заполнено: ${report.updated.length}, без изменений: ${report.unchanged.length}`);

  line("Разделы будут созданы", report.newCategories);
  line("Опубликовано", report.activated);
  line("Уведено в черновики", report.retired);

  if (report.notReady.length) {
    console.log(`\nНе готовы к публикации (${report.notReady.length}):`);
    for (const n of report.notReady) console.log(`   ${n.article} — не хватает: ${n.missing.join(", ")}`);
  }

  line("НЕОДНОЗНАЧНЫЙ артикул — пропущены", report.ambiguous);
  line("Не найдены в базе", report.missing);
  line("Ошибки", report.errors);

  return report.errors.length === 0 && report.ambiguous.length === 0;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL не задан.");
    process.exit(1);
  }

  const finishKeys = loadFinishKeys();
  let list = ONLY ? rows.filter((r) => r.article === ONLY || r.externalId === ONLY) : rows;

  const problems = validate(list, finishKeys);
  if (problems.length) {
    console.error("\n✗ Данные не прошли проверку — в базу ничего не записано:\n");
    for (const p of problems) console.error(`   ${p}`);
    process.exit(1);
  }

  if (LIMIT && !ACTIVATE) list = list.slice(0, LIMIT);
  console.log(`→ ${list.length} товаров${DRY_RUN ? " (сухой прогон)" : ""}`);

  const categoryIds = await ensureCategories();
  for (const r of list) await applyRow(r, categoryIds);

  if (RETIRE_MOCK) await retireMock();
  if (ACTIVATE) await activate();

  const ok = print();
  console.log("");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
