"use server";

import { redirect } from "next/navigation";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@vita/db/client";
import { audit, can, currentAdmin, login, logout, type Capability } from "@/lib/auth";
import { CATALOG_TAG, SETTINGS_TAG, productTag } from "@vita/data/repo/tags";
import { SETTING_KEYS } from "@vita/data/settings";
import { publish } from "@/lib/revalidate";

/* Admin mutations.

   Every write ends with publish(). If the brother changes a price, reloads the
   storefront and still sees the old number, he stops trusting the tool — and
   that trust does not come back.

   Важно: `publish` — это НЕ локальный `revalidateTag`. Витрина живёт в другом
   деплойменте Vercel, и сброс её кэша едет туда HTTP-запросом. Он может не
   дойти, поэтому `publish` возвращает флаг, и экшены обязаны донести его до
   формы: обещать «сайт обновлён», не проверив, — тот самый способ потерять
   доверие, о котором абзац выше.

   Теги импортируются из `@vita/data/repo/tags`, а НЕ из `@vita/data/repo`:
   последний помечен server-only, тянет драйвер БД и мок-каталог и выполняет
   `pickSource()` на уровне модуля. */

const { product, productI18n, variant, price, inventory, setting } = schema;

/* Explicit result shapes. Without them TypeScript narrows each action to
   whichever branch it happens to return, and useActionState rejects the
   mismatch at the call site. */
/* Дефолт — `Record<never, never>`, а не `Record<string, never>`.
   У второго `Partial<T>` объявляет ЛЮБОЙ строковый ключ как `undefined`, и
   собственные поля результата (`error`, `ok`) начинают конфликтовать сами с
   собой, стоит вызвать `ActionResult` без параметра. */
export type ActionResult<T = Record<never, never>> = Partial<T> & {
  ok?: boolean;
  error?: string;
  /* Дошёл ли сброс кэша до витрины. `undefined` — вопрос не поднимался
     (например, ошибка валидации). Формы обязаны различать три состояния, а не
     печатать «сайт обновится сразу» безусловно. */
  published?: boolean;
};

/** Сбросить каталог целиком и, если известны, карточки конкретных товаров. */
function publishCatalog(...handles: (string | null | undefined)[]) {
  return publish([CATALOG_TAG, ...handles.filter(Boolean).map((h) => productTag(h as string))]);
}

async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");
  return admin;
}

/* Server-side gate. Hiding a tab is a courtesy; this is the actual control —
   it holds even if someone types the URL or replays the form post. */
async function requireCapability(capability: Capability) {
  const admin = await requireAdmin();
  if (!can(admin.role, capability)) {
    redirect("/products?denied=1");
  }
  return admin;
}

/* ── auth ──────────────────────────────────────────────────────────────── */

export async function loginAction(_prev: unknown, formData: FormData): Promise<{ error: string } | never> {
  /* Потолок длины важен: scrypt считается ДО того, как выяснится, что пароль
     неверный, поэтому мегабайтная строка стоила бы сервером ровно столько же,
     сколько настоящая попытка. */
  const username = String(formData.get("username") ?? "").slice(0, 100);
  const password = String(formData.get("password") ?? "").slice(0, 200);

  if (!username || !password) {
    return { error: "Введите логин и пароль" };
  }

  const result = await login(username, password);
  if (!result.ok) {
    return {
      error:
        result.reason === "throttled"
          ? "Слишком много попыток. Подождите 15 минут."
          : "Неверный логин или пароль",
    };
  }
  redirect("/products");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}

/* ── products ──────────────────────────────────────────────────────────── */

/* Accepts what a person actually types: "189 000", "189000", with ordinary or
   non-breaking spaces. Rejects anything that is not a whole number of tenge. */
const priceSchema = z
  .string()
  .transform((raw) => raw.replace(/[\s\u00a0\u202f]/g, ""))
  .refine((s) => /^\d+$/.test(s), "Цена должна быть целым числом в тенге")
  .transform((s) => Number(s))
  .refine((n) => n <= 100_000_000, "Цена вне допустимого диапазона");

const stockSchema = z.enum(["in", "order", "out"]);

/** Bulk price + stock edit — the most common job, done from one screen. */
export async function bulkUpdateAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ changed: number }>> {
  const admin = await requireAdmin();

  const updates: { variantId: string; handle: string; retail: number | null; stock: "in" | "order" | "out" }[] = [];

  for (const [key, raw] of formData.entries()) {
    const m = /^price\.(.+)$/.exec(key);
    if (!m) continue;
    const variantId = m[1];
    const handle = String(formData.get(`handle.${variantId}`) ?? "");
    const stockRaw = String(formData.get(`stock.${variantId}`) ?? "order");

    const stock = stockSchema.safeParse(stockRaw);
    if (!stock.success) continue;

    const text = String(raw).trim();
    // Empty means "price on request" — a real state on the price list.
    const parsed = text === "" ? { success: true as const, data: null } : priceSchema.safeParse(text);
    if (!parsed.success) {
      return { error: `Некорректная цена у товара ${handle || variantId}` };
    }

    updates.push({ variantId, handle, retail: parsed.data as number | null, stock: stock.data });
  }

  if (!updates.length) return { error: "Нечего сохранять" };

  let changed = 0;
  const touched: string[] = [];
  for (const u of updates) {
    const [current] = await db()
      .select({ retailKzt: price.retailKzt })
      .from(price)
      .where(eq(price.variantId, u.variantId))
      .orderBy(desc(price.validFrom))
      .limit(1);
    const [stockRow] = await db()
      .select({ state: inventory.state })
      .from(inventory)
      .where(eq(inventory.variantId, u.variantId))
      .limit(1);

    const priceChanged = (current?.retailKzt ?? null) !== u.retail;
    const stockChanged = (stockRow?.state ?? null) !== u.stock;
    if (!priceChanged && !stockChanged) continue;

    if (priceChanged) {
      // Append-only: close the current row, insert the new one. Free history.
      await db()
        .update(price)
        .set({ validTo: new Date() })
        .where(and(eq(price.variantId, u.variantId), sql`${price.validTo} is null`));
      await db().insert(price).values({
        variantId: u.variantId,
        retailKzt: u.retail,
        mode: "manual",
        createdBy: admin.id,
      });
    }

    if (stockChanged) {
      await db()
        .insert(inventory)
        .values({ variantId: u.variantId, state: u.stock, updatedBy: admin.id })
        .onConflictDoUpdate({
          target: inventory.variantId,
          set: { state: u.stock, updatedAt: new Date(), updatedBy: admin.id },
        });
    }

    await audit(admin.id, "variant", u.variantId, "bulk-update", { price: current?.retailKzt ?? null, stock: stockRow?.state ?? null }, { price: u.retail, stock: u.stock });
    touched.push(u.handle);
    changed += 1;
  }

  /* Одна публикация в конце, а не по вебхуку на каждую строку внутри цикла:
     массовая правка на 200 SKU дала бы 200 HTTP-запросов к витрине. */
  const published = await publishCatalog(...touched);
  return { ok: true, changed, published };
}

const productSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(1, "Укажите адрес товара")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Только латиница в нижнем регистре, цифры и дефис"),
  nameRu: z.string().trim().min(1, "Укажите название по-русски"),
  nameKk: z.string().trim().min(1, "Укажите название по-казахски"),
  sku: z.string().trim().min(1, "Укажите артикул"),
  categorySlug: z.string().trim().min(1),
  collectionSlug: z.string().trim().optional(),
  finish: z.string().trim().default(""),
  status: z.enum(["draft", "active", "archived"]),
  stock: stockSchema,
  widthMm: z.coerce.number().int().min(0).max(10_000).optional(),
  depthMm: z.coerce.number().int().min(0).max(10_000).optional(),
  heightMm: z.coerce.number().int().min(0).max(10_000).optional(),
});

/** Create or update one product. */
export async function saveProductAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | never> {
  const admin = await requireAdmin();

  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля формы" };
  }
  const v = parsed.data;

  const rawPrice = String(formData.get("retailKzt") ?? "").trim();
  const rawOld = String(formData.get("oldKzt") ?? "").trim();
  const retail = rawPrice === "" ? null : priceSchema.safeParse(rawPrice);
  const oldPrice = rawOld === "" ? null : priceSchema.safeParse(rawOld);
  if (retail && !retail.success) return { error: "Некорректная цена" };
  if (oldPrice && !oldPrice.success) return { error: "Некорректная старая цена" };

  const productId = String(formData.get("productId") ?? "") || null;

  const [categoryRow] = await db()
    .select({ id: schema.category.id })
    .from(schema.category)
    .where(eq(schema.category.slug, v.categorySlug))
    .limit(1);
  if (!categoryRow) return { error: `Категория "${v.categorySlug}" не найдена` };

  const [collectionRow] = v.collectionSlug
    ? await db()
        .select({ id: schema.collection.id })
        .from(schema.collection)
        .where(eq(schema.collection.slug, v.collectionSlug))
        .limit(1)
    : [undefined];

  // Handles are the product's public URL — a collision would silently shadow
  // another product, so reject it explicitly.
  const [clash] = await db()
    .select({ id: product.id })
    .from(product)
    .where(eq(product.handle, v.handle))
    .limit(1);
  if (clash && clash.id !== productId) {
    return { error: `Адрес "${v.handle}" уже занят другим товаром` };
  }

  /* Прежний хендл нужен для ревалидации.

     Поле `handle` редактируемое, и это адрес товара на витрине. Если
     сбросить только НОВЫЙ тег, страница по старому адресу останется в кэше со
     старыми данными и продолжит отдавать 200 — то есть в поиске и по чужим
     ссылкам будет висеть товар, которого уже нет по этому пути. */
  const [previous] = productId
    ? await db().select({ handle: product.handle }).from(product).where(eq(product.id, productId)).limit(1)
    : [undefined];

  const [brandRow] = await db()
    .select({ id: schema.brand.id })
    .from(schema.brand)
    .where(eq(schema.brand.code, "vita-lux"))
    .limit(1);
  if (!brandRow) return { error: "Бренд vita-lux не найден — выполните pnpm db:seed" };

  const values = {
    handle: v.handle,
    brandId: brandRow.id,
    categoryId: categoryRow.id,
    collectionId: collectionRow?.id ?? null,
    baseArticle: v.sku,
    status: v.status,
    widthMm: v.widthMm ?? null,
    depthMm: v.depthMm ?? null,
    heightMm: v.heightMm ?? null,
    updatedAt: new Date(),
  };

  let id = productId;
  if (id) {
    await db().update(product).set(values).where(eq(product.id, id));
  } else {
    const [row] = await db().insert(product).values(values).returning({ id: product.id });
    id = row.id;
  }

  for (const [locale, name] of [["ru", v.nameRu], ["kk", v.nameKk]] as const) {
    await db()
      .insert(productI18n)
      .values({ productId: id, locale, name })
      .onConflictDoUpdate({ target: [productI18n.productId, productI18n.locale], set: { name } });
  }

  const [existingVariant] = await db()
    .select({ id: variant.id })
    .from(variant)
    .where(and(eq(variant.productId, id), eq(variant.isDefault, true)))
    .limit(1);

  let variantId = existingVariant?.id;
  if (variantId) {
    await db().update(variant).set({ sku: v.sku, finish: v.finish }).where(eq(variant.id, variantId));
  } else {
    const [row] = await db()
      .insert(variant)
      .values({ productId: id, sku: v.sku, finish: v.finish, isDefault: true })
      .returning({ id: variant.id });
    variantId = row.id;
  }

  await db()
    .update(price)
    .set({ validTo: new Date() })
    .where(and(eq(price.variantId, variantId), sql`${price.validTo} is null`));
  await db().insert(price).values({
    variantId,
    retailKzt: retail && retail.success ? retail.data : null,
    oldKzt: oldPrice && oldPrice.success ? oldPrice.data : null,
    mode: "manual",
    createdBy: admin.id,
  });

  await db()
    .insert(inventory)
    .values({ variantId, state: v.stock, updatedBy: admin.id })
    .onConflictDoUpdate({
      target: inventory.variantId,
      set: { state: v.stock, updatedAt: new Date(), updatedBy: admin.id },
    });

  await audit(admin.id, "product", id, productId ? "update" : "create", null, values);
  // Оба хендла: при переименовании старый адрес обязан выпасть из кэша витрины.
  await publishCatalog(v.handle, previous?.handle);

  redirect("/products");
}

/** Show / hide a product on the storefront without deleting it. */
export async function toggleVisibilityAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  /* Раньше экшен при любой неувязке делал голый `return`, и форма отправлялась
     без обратной связи: человек нажимал «Скрыть с сайта», ничего не менялось, и
     понять почему было нельзя. Теперь каждый выход что-то сообщает. */
  const id = String(formData.get("productId") ?? "");
  const handle = String(formData.get("handle") ?? "");
  if (!z.string().uuid().safeParse(id).success) return { error: "Некорректный товар" };

  const [row] = await db().select({ status: product.status }).from(product).where(eq(product.id, id)).limit(1);
  if (!row) return { error: "Товар не найден" };

  const next = row.status === "active" ? "draft" : "active";
  await db().update(product).set({ status: next, updatedAt: new Date() }).where(eq(product.id, id));
  await audit(admin.id, "product", id, "visibility", { status: row.status }, { status: next });
  const published = await publishCatalog(handle);
  return { ok: true, published };
}

/* ── settings ──────────────────────────────────────────────────────────── */

export async function saveSettingsAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: number }>> {
  const admin = await requireCapability("settings");
  let saved = 0;

  /* Белый список ключей — из того же источника, что читает витрина.

     Раньше цикл принимал ЛЮБОЙ ключ по маске `setting.*` и писал его как есть:
     подделанный POST мог насыпать в таблицу произвольные строки, а опечатка в
     имени поля создавала мёртвую настройку, которую никто никогда не прочитает
     (именно так и появились ключи `pricing.*`). */
  const allowed = new Set(Object.values(SETTING_KEYS));

  for (const [key, raw] of formData.entries()) {
    const m = /^setting\.(.+)$/.exec(key);
    if (!m) continue;
    if (!allowed.has(m[1])) return { error: `Неизвестная настройка «${m[1]}»` };

    const text = String(raw).trim();
    // Numeric-looking settings are stored as numbers so the storefront can do
    // arithmetic without parsing.
    const value: unknown = text !== "" && /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text;

    await db()
      .insert(setting)
      .values({ key: m[1], value, updatedBy: admin.id })
      .onConflictDoUpdate({ target: setting.key, set: { value, updatedAt: new Date(), updatedBy: admin.id } });
    saved += 1;
  }

  /* SETTINGS_TAG, а не каталог.

     До этой правки здесь стоял `refreshCatalog()`, то есть сбрасывался кэш
     каталога — а настройки читаются через СВОЙ `unstable_cache` с тегом
     `settings` (packages/data/src/settings.ts). Тег этот не сбрасывался нигде
     во всём репозитории, поэтому смена телефона, города, адреса, порога
     бесплатной доставки и срока рассрочки не доезжала до витрины никогда, а
     форма при этом писала «Сохранено. Сайт обновится сразу». */
  const published = await publish([SETTINGS_TAG]);
  return { ok: true, saved, published };
}

/* ── read helpers for the admin screens ────────────────────────────────── */

export interface AdminProductRow {
  productId: string;
  variantId: string | null;
  handle: string;
  name: string;
  sku: string | null;
  categorySlug: string;
  status: "draft" | "active" | "archived";
  retailKzt: number | null;
  stock: "in" | "order" | "out" | null;
  image: string | null;
}

/**
 * Список товаров для админских экранов.
 *
 * `categorySlug` и `limit` появились не для красоты. Экран `/bulk` рендерит на
 * каждую строку два поля ввода и сохраняет всё одним запросом, а серверный цикл
 * делает на строку до пяти обращений к БД ПОСЛЕДОВАТЕЛЬНО. На 19 товарах это
 * незаметно, на 200 — сотни полей в одном DOM и запрос, который упрётся в
 * таймаут функции. Поэтому массовое редактирование теперь идёт по категориям.
 *
 * Метасимволы LIKE в запросе экранируются: без этого «100%» в поиске означало
 * бы «что угодно», а «_» — «любой символ».
 */
export async function listAdminProducts(
  query?: string,
  opts?: { categorySlug?: string; limit?: number },
): Promise<AdminProductRow[]> {
  await requireAdmin();

  const search = query?.trim();
  const escaped = search?.replace(/[\\%_]/g, (c) => `\\${c}`);
  const conditions = [];
  if (escaped) {
    conditions.push(
      or(
        ilike(productI18n.name, `%${escaped}%`),
        ilike(product.handle, `%${escaped}%`),
        ilike(variant.sku, `%${escaped}%`),
      ),
    );
  }
  if (opts?.categorySlug) conditions.push(eq(schema.category.slug, opts.categorySlug));
  const where = conditions.length ? and(...conditions) : undefined;

  return db()
    .select({
      productId: product.id,
      variantId: variant.id,
      handle: product.handle,
      name: sql<string>`coalesce(${productI18n.name}, ${product.handle})`,
      sku: variant.sku,
      categorySlug: schema.category.slug,
      status: product.status,
      retailKzt: price.retailKzt,
      stock: inventory.state,
      image: schema.media.url,
    })
    .from(product)
    .innerJoin(schema.category, eq(schema.category.id, product.categoryId))
    .leftJoin(productI18n, and(eq(productI18n.productId, product.id), eq(productI18n.locale, "ru")))
    .leftJoin(variant, and(eq(variant.productId, product.id), eq(variant.isDefault, true)))
    .leftJoin(price, and(eq(price.variantId, variant.id), sql`${price.validTo} is null`))
    .leftJoin(inventory, eq(inventory.variantId, variant.id))
    .leftJoin(schema.media, and(eq(schema.media.productId, product.id), eq(schema.media.sort, 0)))
    .where(where)
    .orderBy(schema.category.sort, product.sortWeight)
    .limit(opts?.limit ?? 500);
}

/** Категории для фильтра — нужен и списку товаров, и массовому редактированию. */
export async function listCategorySlugs(): Promise<string[]> {
  await requireAdmin();
  const rows = await db()
    .select({ slug: schema.category.slug })
    .from(schema.category)
    .orderBy(schema.category.sort);
  return rows.map((r) => r.slug);
}
