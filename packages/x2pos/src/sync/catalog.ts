/* Catalogue import: X2pos → our database.

   The whole design follows from one fact about the source data: X2pos is a
   warehouse register, not a shop window. Thirty-six of the ninety-two products
   are called «Унитаз» and seventeen «Раковина чаша»; there is a single
   category, «товары без группы». Nothing here can produce a sellable product
   page on its own.

   So this importer owns exactly four things — that a product exists, its
   article, its price and its photo — and it is forbidden from touching
   anything a human writes: the handle, the ru/kk names, the description, the
   category, the facets, the SEO fields. New products land as `draft`, which
   every read path already filters out, and stay invisible until someone gives
   them a name and a category in the admin.

   Consequence worth stating plainly: running this does not put anything on the
   site. It stages work for a human. */

import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { schema, type Database } from "@vita/db/client";
import {
  X2POS_SOURCE,
  applyMarkup,
  findAnomalies,
  guessBrandCode,
  pickImageUrl,
  qtyToStockState,
  suggestHandle,
  toFlag,
  toKzt,
  toQty,
  type Anomaly,
} from "../map.ts";
import type { X2posClient } from "../client.ts";
import type { Product } from "../types.ts";
import { emptyReport, type SyncReport } from "./report.ts";
import { CURSOR_PRODUCTS, readState, writeState } from "./state.ts";

/* Draft products need a category, and `product.categoryId` is NOT NULL. They
   must not land in a real one — that would put unnamed rows in a customer's
   view the moment someone flips them to active by mistake. This category is
   created inactive, so `listCategories` filters it out of navigation. */
export const INBOX_CATEGORY_SLUG = "x2pos-inbox";

export interface SyncCatalogOptions {
  db: Database;
  client: X2posClient;
  /** Shop-wide markup in basis points. From `getSettings().globalMarkupBp`. */
  markupBp: number;
  /** Units held back from the site. From `getSettings().stockBufferQty`. */
  bufferQty: number;
  /** Report what would change, write nothing. */
  dryRun?: boolean;
  /** Import everything, ignoring the "nothing changed upstream" cursor. */
  force?: boolean;
}

export async function syncCatalog(opts: SyncCatalogOptions): Promise<SyncReport> {
  const { db, client, markupBp, bufferQty } = opts;
  const dryRun = opts.dryRun ?? false;
  const report = emptyReport(dryRun);

  /* 1. Is there anything to do? The cheap question, asked first. */
  const news = await client.getWhatIsNew();
  const upstream = news.product_last_updated ?? null;
  const cursor = await readState<string>(db, CURSOR_PRODUCTS);
  if (!opts.force && upstream && cursor === upstream) {
    report.skipped = true;
    report.skipReason = `каталог не менялся с ${upstream}`;
    report.finishedAt = new Date().toISOString();
    return report;
  }

  /* 2. Pull products and stock together — stock is needed to tell "unpriced
        but sitting on the shelf" (a real problem) from "unpriced and absent"
        (not worth anyone's time). */
  const products = await client.listAllProducts();
  const stock = await client.getStock().catch((e: unknown) => {
    report.errors.push(`остатки не получены: ${errText(e)}`);
    return new Map<string, number>();
  });
  report.productsSeen = products.length;

  const context = await loadContext(db);

  for (const p of products) {
    try {
      await importProduct({ db, product: p, stock, markupBp, bufferQty, dryRun, report, context });
    } catch (e) {
      report.errors.push(`товар ${p.product_id} (${p.product_name}): ${errText(e)}`);
    }
  }

  /* 3. Only advance the cursor on a clean, real run. A dry run must not make
        the next real run think it already imported this. */
  if (!dryRun && upstream && report.errors.length === 0) {
    await writeState(db, CURSOR_PRODUCTS, upstream);
  }

  report.finishedAt = new Date().toISOString();
  return report;
}

/* ── one product ───────────────────────────────────────────────────────── */

interface Context {
  brandIds: Map<string, string>;
  inboxCategoryId: string | null;
  takenHandles: Set<string>;
}

interface ImportArgs {
  db: Database;
  product: Product;
  stock: Map<string, number>;
  markupBp: number;
  bufferQty: number;
  dryRun: boolean;
  report: SyncReport;
  context: Context;
}

async function importProduct(args: ImportArgs): Promise<void> {
  const { db, product: p, stock, markupBp, dryRun, report, context } = args;

  /* X2pos guarantees at least one variation, and in this catalogue every
     product has exactly one ("generic"). Multi-variation products are handled
     by mapping each variation to a variant of the same product. */
  const variations = Object.values(p.variations ?? {});
  if (variations.length === 0) return;

  const externalId = p.product_id;
  const deletedUpstream = toFlag(p.product_is_deleted);

  const existing = await db
    .select({ id: schema.product.id, handle: schema.product.handle, status: schema.product.status })
    .from(schema.product)
    .where(
      and(
        eq(schema.product.externalSource, X2POS_SOURCE),
        eq(schema.product.externalId, externalId),
      ),
    )
    .limit(1);

  /* A product deleted upstream is archived, never deleted: order_item rows
     point at its variants and a placed order must stay readable forever. */
  if (deletedUpstream) {
    if (existing[0] && existing[0].status !== "archived") {
      report.productsArchived++;
      report.touchedHandles.push(existing[0].handle);
      if (!dryRun) {
        await db
          .update(schema.product)
          .set({ status: "archived", updatedAt: new Date() })
          .where(eq(schema.product.id, existing[0].id));
        await db
          .update(schema.inventory)
          .set({ state: "out", updatedAt: new Date() })
          .where(
            inArray(
              schema.inventory.variantId,
              db
                .select({ id: schema.variant.id })
                .from(schema.variant)
                .where(eq(schema.variant.productId, existing[0].id)),
            ),
          );
      }
    }
    return;
  }

  const vendorCode = (p.product_vendor_code ?? variations[0]?.vendor_code ?? "").trim() || null;

  let productId: string;
  let handle: string;

  if (existing[0]) {
    productId = existing[0].id;
    handle = existing[0].handle;
    report.productsUpdated++;
  } else {
    /* A dry run must work on a database that has never seen a real run, so a
       missing staging category is only fatal when we are actually writing —
       `ensureInboxCategory` creates it just before the real import. */
    if (!context.inboxCategoryId && !dryRun) {
      throw new Error(`нет категории «${INBOX_CATEGORY_SLUG}» для черновиков`);
    }
    const brandId = context.brandIds.get(guessBrandCode(vendorCode));
    if (!brandId && !dryRun) throw new Error("в базе нет бренда vita-lux/smoow");

    handle = uniqueHandle(suggestHandle(vendorCode, externalId), context.takenHandles);
    report.productsCreated++;

    if (dryRun) {
      productId = "(dry-run)";
    } else {
      const inserted = await db
        .insert(schema.product)
        .values({
          handle,
          brandId: brandId!,
          categoryId: context.inboxCategoryId!,
          baseArticle: vendorCode,
          /* Draft is the whole point: invisible everywhere until a human
             names it and files it under a real category. */
          status: "draft",
          externalId,
          externalSource: X2POS_SOURCE,
        })
        .returning({ id: schema.product.id });
      productId = inserted[0].id;

      /* A placeholder name, not the X2pos one. `product_i18n.name` is NOT
         NULL, and importing «Унитаз» thirty-six times would look like real
         content and quietly get published. The article reads as unfinished,
         which is exactly what it is. */
      const placeholder = vendorCode ?? `X2pos ${externalId}`;
      await db.insert(schema.productI18n).values([
        { productId, locale: "ru", name: placeholder },
        { productId, locale: "kk", name: placeholder },
      ]);
    }
  }

  report.touchedHandles.push(handle);

  /* ── variants, prices, inventory ─────────────────────────────────────── */

  for (const [index, v] of variations.entries()) {
    const variationId = v.id;
    const vCode = (v.vendor_code ?? vendorCode ?? "").trim() || vendorCode;
    const sku = vCode ?? `X2POS-${variationId}`;

    const baseRetail = toKzt(v.retail_price);
    const wholesale = toKzt(v.wholesale_price);
    const retail = applyMarkup(baseRetail, markupBp);
    const qty = toQty(stock.get(variationId));
    const imageUrl = pickImageUrl({ image_url: v.image_url ?? p.image_url });

    report.anomalies.push(
      ...findAnomalies({
        externalId,
        productName: p.product_name,
        vendorCode: vCode,
        retailKzt: retail,
        wholesaleKzt: wholesale,
        qty,
        imageUrl,
      }),
    );

    if (dryRun) {
      report.pricesWritten++;
      report.inventoryUpdated++;
      continue;
    }

    /* Variant identity is the X2pos variation id, matched by the partial
       unique index. SKU cannot be the key — the price list repeats articles. */
    const existingVariant = await db
      .select({ id: schema.variant.id })
      .from(schema.variant)
      .where(eq(schema.variant.externalId, variationId))
      .limit(1);

    let variantId: string;
    if (existingVariant[0]) {
      variantId = existingVariant[0].id;
      await db.update(schema.variant).set({ sku }).where(eq(schema.variant.id, variantId));
    } else {
      const inserted = await db
        .insert(schema.variant)
        .values({
          productId,
          sku,
          finish: "white-gloss", // placeholder; the admin sets the real finish
          isDefault: index === 0,
          status: "active",
          sort: index,
          externalId: variationId,
        })
        .returning({ id: schema.variant.id });
      variantId = inserted[0].id;
    }

    await writePrice({ db, variantId, retail, wholesale, baseRetail, markupBp, report });

    const state = qtyToStockState(qty, args.bufferQty);
    await db
      .insert(schema.inventory)
      .values({ variantId, state, qty, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.inventory.variantId,
        set: { state, qty, updatedAt: new Date() },
      });
    report.inventoryUpdated++;
  }
}

/* ── pricing ───────────────────────────────────────────────────────────── */

interface WritePriceArgs {
  db: Database;
  variantId: string;
  retail: number | null;
  wholesale: number | null;
  baseRetail: number | null;
  markupBp: number;
  report: SyncReport;
}

/**
 * Append a new price row — but only when it would actually change something,
 * and never over the top of a human's decision.
 *
 * The price table is append-only and the newest row in force wins. That makes
 * a manual override durable only for as long as nothing newer is written, so
 * the rule has to be absolute: **while an admin's manual price is in force,
 * the sync writes nothing for that variant.** The X2pos figure is reported as
 * skipped rather than quietly winning three hours later.
 *
 * `createdBy` is left null on purpose. `scripts/seed.ts` reads a non-null
 * `createdBy` as "a human edited this" and skips such products; a sync filling
 * it in would make the seeder treat every imported product as hand-tuned.
 * Authorship here is carried by `mode`, not by `createdBy`.
 */
async function writePrice(args: WritePriceArgs): Promise<void> {
  const { db, variantId, retail, wholesale, baseRetail, markupBp, report } = args;

  const current = await db
    .select({
      id: schema.price.id,
      mode: schema.price.mode,
      retailKzt: schema.price.retailKzt,
      wholesaleKzt: schema.price.wholesaleKzt,
      baseRetailKzt: schema.price.baseRetailKzt,
    })
    .from(schema.price)
    .where(
      and(
        eq(schema.price.variantId, variantId),
        sql`${schema.price.validFrom} <= now()`,
        or(isNull(schema.price.validTo), sql`${schema.price.validTo} > now()`),
      ),
    )
    .orderBy(sql`${schema.price.validFrom} desc`)
    .limit(1);

  const active = current[0];

  if (active?.mode === "manual") {
    /* The shop's price stands. But `wholesaleKzt` and `baseRetailKzt` are not
       the shop's decision — they are reference figures from X2pos, and the
       storefront shows the wholesale one next to the retail price. Refreshing
       them in place keeps that display correct without touching a single
       tenge the customer pays. Appending a row instead would silently
       out-rank the admin's price three hours later, which is the one thing
       this function exists to prevent. */
    if (active.wholesaleKzt !== wholesale || active.baseRetailKzt !== baseRetail) {
      await db
        .update(schema.price)
        .set({ wholesaleKzt: wholesale, baseRetailKzt: baseRetail })
        .where(eq(schema.price.id, active.id));
    }
    report.pricesSkippedManual++;
    return;
  }

  const unchanged =
    active &&
    active.retailKzt === retail &&
    active.wholesaleKzt === wholesale &&
    active.baseRetailKzt === baseRetail;
  if (unchanged) return;

  /* Закрываем предыдущую открытую строку, как это делает админка
     (apps/admin/src/app/actions.ts). Без этого на разновидности копятся две
     действующие строки: витрина выбирает из них по `validFrom desc`, так что
     цена будет верной, но история превращается в кашу, а любой запрос «какая
     сейчас цена» перестаёт иметь единственный ответ.

     Строки с будущим `validTo` — запланированные акции — не трогаем: они
     обязаны пережить обновление цены из X2pos и отработать свой срок. */
  await db
    .update(schema.price)
    .set({ validTo: new Date() })
    .where(and(eq(schema.price.variantId, variantId), isNull(schema.price.validTo)));

  await db.insert(schema.price).values({
    variantId,
    retailKzt: retail,
    wholesaleKzt: wholesale,
    baseRetailKzt: baseRetail,
    markupBp,
    mode: "auto",
  });
  report.pricesWritten++;
}

/* ── helpers ───────────────────────────────────────────────────────────── */

async function loadContext(db: Database): Promise<Context> {
  const brands = await db
    .select({ id: schema.brand.id, code: schema.brand.code })
    .from(schema.brand);
  const inbox = await db
    .select({ id: schema.category.id })
    .from(schema.category)
    .where(eq(schema.category.slug, INBOX_CATEGORY_SLUG))
    .limit(1);
  const handles = await db.select({ handle: schema.product.handle }).from(schema.product);

  return {
    brandIds: new Map(brands.map((b) => [b.code, b.id])),
    inboxCategoryId: inbox[0]?.id ?? null,
    takenHandles: new Set(handles.map((h) => h.handle)),
  };
}

/** Ensure the staging category exists. Inactive, so it never shows in nav. */
export async function ensureInboxCategory(db: Database): Promise<void> {
  await db
    .insert(schema.category)
    .values({ slug: INBOX_CATEGORY_SLUG, isActive: false, sort: 9_999 })
    .onConflictDoNothing({ target: schema.category.slug });
}

/* `product.handle` is unique and articles do repeat across products, so a
   suffix is sometimes unavoidable. It is provisional either way — the admin
   replaces it with a real URL before publishing. */
function uniqueHandle(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
  throw new Error(`не удалось подобрать handle для ${base}`);
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/* Products the sync created that are still waiting for a human. This is the
   actual work queue after an import. */
export async function listDrafts(db: Database) {
  return db
    .select({
      id: schema.product.id,
      handle: schema.product.handle,
      baseArticle: schema.product.baseArticle,
      externalId: schema.product.externalId,
    })
    .from(schema.product)
    .where(
      and(
        eq(schema.product.externalSource, X2POS_SOURCE),
        eq(schema.product.status, "draft"),
        isNotNull(schema.product.externalId),
      ),
    )
    .orderBy(schema.product.baseArticle);
}
