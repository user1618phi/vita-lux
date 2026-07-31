"use server";

import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@vita/db/client";
import { audit, can, currentAdmin, login, logout, type Capability } from "@/lib/auth";
import { CATALOG_TAG, productTag } from "@vita/data/repo";

/* Admin mutations.

   Every write ends with revalidateTag. If the brother changes a price, reloads
   the storefront and still sees the old number, he stops trusting the tool —
   and that trust does not come back. */

const { product, productI18n, variant, price, inventory, setting } = schema;

/* Explicit result shapes. Without them TypeScript narrows each action to
   whichever branch it happens to return, and useActionState rejects the
   mismatch at the call site. */
export type ActionResult<T = Record<string, never>> = Partial<T> & { ok?: boolean; error?: string };

function refreshCatalog(handle?: string) {
  revalidateTag(CATALOG_TAG);
  if (handle) revalidateTag(productTag(handle));
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
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

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
    refreshCatalog(u.handle);
    changed += 1;
  }

  refreshCatalog();
  return { ok: true, changed };
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
  refreshCatalog(v.handle);

  redirect("/products");
}

/** Show / hide a product on the storefront without deleting it. */
export async function toggleVisibilityAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("productId") ?? "");
  const handle = String(formData.get("handle") ?? "");
  if (!id) return;

  const [row] = await db().select({ status: product.status }).from(product).where(eq(product.id, id)).limit(1);
  if (!row) return;

  const next = row.status === "active" ? "draft" : "active";
  await db().update(product).set({ status: next, updatedAt: new Date() }).where(eq(product.id, id));
  await audit(admin.id, "product", id, "visibility", { status: row.status }, { status: next });
  refreshCatalog(handle);
}

/* ── settings ──────────────────────────────────────────────────────────── */

export async function saveSettingsAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: number }>> {
  const admin = await requireCapability("settings");
  let saved = 0;

  for (const [key, raw] of formData.entries()) {
    const m = /^setting\.(.+)$/.exec(key);
    if (!m) continue;
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

  refreshCatalog();
  return { ok: true, saved };
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

export async function listAdminProducts(query?: string): Promise<AdminProductRow[]> {
  await requireAdmin();

  const search = query?.trim();
  const where = search
    ? or(
        ilike(productI18n.name, `%${search}%`),
        ilike(product.handle, `%${search}%`),
        ilike(variant.sku, `%${search}%`),
      )
    : undefined;

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
    .orderBy(schema.category.sort, product.sortWeight);
}
