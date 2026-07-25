import Link from "next/link";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/client";
import { currentAdmin } from "@/lib/auth";
import { AdminNav } from "../../ui";
import { ProductForm, type ProductFormValues } from "../ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  if (!(await currentAdmin())) redirect("/admin/login");

  const categories = (
    await db().select({ slug: schema.category.slug }).from(schema.category).orderBy(schema.category.sort)
  ).map((c) => c.slug);
  const collections = (
    await db().select({ slug: schema.collection.slug }).from(schema.collection).orderBy(schema.collection.sort)
  ).map((c) => c.slug);

  const values: ProductFormValues = {
    handle: "",
    nameRu: "",
    nameKk: "",
    sku: "",
    categorySlug: categories[0] ?? "",
    collectionSlug: "",
    finish: "",
    // New products start hidden: nobody wants a half-filled card going live
    // while they are still typing the specs.
    status: "draft",
    stock: "in",
    retailKzt: null,
    oldKzt: null,
    widthMm: null,
    depthMm: null,
    heightMm: null,
  };

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-5 pb-16">
      <Link href="/admin/products" className="font-sans text-[14px] text-slate" style={{ textDecoration: "none" }}>
        ← Все товары
      </Link>
      <h1 className="mt-2 mb-4 font-display text-[22px] text-ink">Новый товар</h1>
      <AdminNav current="products" />
      <div className="mt-5">
        <ProductForm values={values} categories={categories} collections={collections} photos={[]} />
      </div>
    </main>
  );
}
