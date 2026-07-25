import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { currentAdmin } from "@/lib/auth";
import { AdminNav } from "../../ui";
import { ProductForm, type ProductFormValues } from "../ProductForm";

export const dynamic = "force-dynamic";

const { product, productI18n, variant, price, inventory, media, category, collection } = schema;

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await currentAdmin())) redirect("/admin/login");
  const { id } = await params;

  const [row] = await db()
    .select({
      productId: product.id,
      handle: product.handle,
      status: product.status,
      categorySlug: category.slug,
      collectionSlug: collection.slug,
      widthMm: product.widthMm,
      depthMm: product.depthMm,
      heightMm: product.heightMm,
      sku: variant.sku,
      finish: variant.finish,
      retailKzt: price.retailKzt,
      oldKzt: price.oldKzt,
      stock: inventory.state,
    })
    .from(product)
    .innerJoin(category, eq(category.id, product.categoryId))
    .leftJoin(collection, eq(collection.id, product.collectionId))
    .leftJoin(variant, and(eq(variant.productId, product.id), eq(variant.isDefault, true)))
    .leftJoin(price, and(eq(price.variantId, variant.id), sql`${price.validTo} is null`))
    .leftJoin(inventory, eq(inventory.variantId, variant.id))
    .where(eq(product.id, id))
    .limit(1);

  if (!row) notFound();

  const names = await db()
    .select({ locale: productI18n.locale, name: productI18n.name })
    .from(productI18n)
    .where(eq(productI18n.productId, id));

  const photos = await db()
    .select({ id: media.id, url: media.url })
    .from(media)
    .where(and(eq(media.productId, id), eq(media.kind, "photo")))
    .orderBy(media.sort);

  const categories = (await db().select({ slug: category.slug }).from(category).orderBy(category.sort)).map((c) => c.slug);
  const collections = (await db().select({ slug: collection.slug }).from(collection).orderBy(collection.sort)).map((c) => c.slug);

  const values: ProductFormValues = {
    productId: row.productId,
    handle: row.handle,
    nameRu: names.find((n) => n.locale === "ru")?.name ?? "",
    nameKk: names.find((n) => n.locale === "kk")?.name ?? "",
    sku: row.sku ?? "",
    categorySlug: row.categorySlug,
    collectionSlug: row.collectionSlug ?? "",
    finish: row.finish ?? "",
    status: row.status,
    stock: row.stock ?? "order",
    retailKzt: row.retailKzt,
    oldKzt: row.oldKzt,
    widthMm: row.widthMm,
    depthMm: row.depthMm,
    heightMm: row.heightMm,
  };

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-5 pb-16">
      <Link href="/admin/products" className="font-sans text-[14px] text-slate" style={{ textDecoration: "none" }}>
        ← Все товары
      </Link>
      <h1 className="mt-2 mb-4 font-display text-[22px] text-ink">{values.nameRu || values.handle}</h1>
      <AdminNav current="products" />
      <div className="mt-5">
        <ProductForm values={values} categories={categories} collections={collections} photos={photos} />
      </div>
    </main>
  );
}
