import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@vita/db/client";
import { INBOX_SLUG, checksFor, publishable, type Checks } from "@vita/core/readiness";

/* Список товаров админки и их готовность к продаже.

   Главная работа в этой админке — довести приехавшие из X2pos черновики до
   состояния, в котором их можно показать покупателю. Пока это была свалка:
   список карточек, по которому нельзя понять, что именно осталось сделать.
   Здесь то же самое становится очередью с понятным концом.

   Сами ПРАВИЛА готовности живут в `@vita/core/readiness` — их спрашивает ещё и
   скрипт наполнения каталога, решая, какие черновики имеет право включить.
   Здесь остался только запрос в базу. */

export { INBOX_SLUG, checksFor, publishable };
export type { Checks };

export interface ProductRow {
  productId: string;
  variantId: string | null;
  handle: string;
  name: string;
  sku: string | null;
  categorySlug: string;
  status: "draft" | "active" | "archived";
  retailKzt: number | null;
  wholesaleKzt: number | null;
  qty: number | null;
  stock: "in" | "order" | "out" | null;
  photos: number;
  image: string | null;
  fromX2pos: boolean;
}

export interface ListOpts {
  q?: string;
  status?: string;
  issue?: string;
  category?: string;
}

export async function listProducts(opts: ListOpts = {}): Promise<ProductRow[]> {
  const d = db();
  const priceIsCurrent = and(sql`${schema.price.validFrom} <= now()`, isNull(schema.price.validTo));

  const rows = await d
    .select({
      productId: schema.product.id,
      variantId: schema.variant.id,
      handle: schema.product.handle,
      nameRu: schema.productI18n.name,
      sku: schema.variant.sku,
      article: schema.product.baseArticle,
      categorySlug: schema.category.slug,
      status: schema.product.status,
      retailKzt: schema.price.retailKzt,
      wholesaleKzt: schema.price.wholesaleKzt,
      qty: schema.inventory.qty,
      stock: schema.inventory.state,
      externalSource: schema.product.externalSource,
      image: schema.media.url,
      photos: sql<number>`(select count(*)::int from ${schema.media} m where m.product_id = ${schema.product.id})`,
    })
    .from(schema.product)
    .innerJoin(schema.category, eq(schema.category.id, schema.product.categoryId))
    .leftJoin(
      schema.productI18n,
      and(eq(schema.productI18n.productId, schema.product.id), eq(schema.productI18n.locale, "ru")),
    )
    .leftJoin(
      schema.variant,
      and(eq(schema.variant.productId, schema.product.id), eq(schema.variant.isDefault, true)),
    )
    .leftJoin(schema.price, and(eq(schema.price.variantId, schema.variant.id), priceIsCurrent))
    .leftJoin(schema.inventory, eq(schema.inventory.variantId, schema.variant.id))
    .leftJoin(
      schema.media,
      and(eq(schema.media.productId, schema.product.id), eq(schema.media.sort, 0)),
    )
    .orderBy(asc(schema.category.slug), asc(schema.product.sortWeight), asc(schema.product.handle));

  let list: ProductRow[] = rows.map((r) => ({
    productId: r.productId,
    variantId: r.variantId,
    handle: r.handle,
    name: r.nameRu ?? r.handle,
    sku: r.sku ?? r.article,
    categorySlug: r.categorySlug,
    status: r.status,
    retailKzt: r.retailKzt,
    wholesaleKzt: r.wholesaleKzt,
    qty: r.qty,
    stock: r.stock,
    photos: Number(r.photos),
    image: r.image,
    fromX2pos: r.externalSource === "x2pos",
  }));

  /* Фильтрация в памяти. На 111 товарах это дешевле, чем городить условия в
     SQL, и по той же причине так уже сделан фильтр каталога на витрине. */
  const q = opts.q?.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        p.handle.includes(q),
    );
  }
  if (opts.status && opts.status !== "all") list = list.filter((p) => p.status === opts.status);
  if (opts.category) list = list.filter((p) => p.categorySlug === opts.category);

  switch (opts.issue) {
    case "nophoto":
      list = list.filter((p) => p.photos === 0);
      break;
    case "noprice":
      list = list.filter((p) => p.retailKzt === null && (p.qty ?? 0) > 0);
      break;
    case "ready":
      list = list.filter((p) => publishable(checksFor(p)) && p.status === "draft");
      break;
  }

  return list;
}
