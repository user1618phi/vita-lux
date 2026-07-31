import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@vita/db/client";

/* Готовность товара к продаже.

   Главная работа в этой админке — довести 92 приехавших из X2pos черновика до
   состояния, в котором их можно показать покупателю. Пока это была свалка:
   список карточек, по которому нельзя понять, что именно осталось сделать.

   Здесь то же самое становится очередью с понятным концом. Пять требований,
   каждое либо закрыто, либо нет:

     имя      — в X2pos 36 товаров называются «Унитаз», такое имя витрине не
                годится, поэтому осмысленным считается только то, что отличается
                от артикула
     раздел   — товар лежит не в служебной категории `x2pos-inbox`
     фото     — есть хотя бы одна карточка media
     цена     — есть действующая розничная цена; без неё витрина рисует
                «Цена по запросу» и не даёт положить в корзину
     остаток  — на складе что-то есть

   Опубликовать можно, когда закрыты первые четыре: товар под заказ с нулевым
   остатком продавать законно, а вот без имени или без цены — нет. */

export const INBOX_SLUG = "x2pos-inbox";

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

export interface Checks {
  name: boolean;
  category: boolean;
  photo: boolean;
  price: boolean;
  stock: boolean;
}

export function checksFor(p: ProductRow): Checks {
  const article = (p.sku ?? "").trim().toLowerCase();
  const name = p.name.trim().toLowerCase();
  return {
    /* Имя, совпадающее с артикулом, — это заглушка, которую поставил синк. */
    name: name.length > 0 && name !== article && !name.startsWith("x2pos "),
    category: p.categorySlug !== INBOX_SLUG,
    photo: p.photos > 0,
    price: p.retailKzt !== null,
    stock: (p.qty ?? 0) > 0,
  };
}

/** Можно ли публиковать: остаток не обязателен, остальное обязательно. */
export function publishable(c: Checks): boolean {
  return c.name && c.category && c.photo && c.price;
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
