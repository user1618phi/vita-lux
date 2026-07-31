import Link from "next/link";
import { redirect } from "next/navigation";
import { db, schema } from "@vita/db/client";
import { currentAdmin } from "@/lib/auth";
import { logoutAction } from "../../actions";
import { AdminNav, PageShell } from "../../ui";
import { ProductForm, type ProductFormValues } from "../ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

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
    <PageShell
      title="Новый товар"
      aside={
        <Link
          href="/products"
          className="font-sans"
          style={{ fontSize: "var(--text-body-s)", color: "var(--text-secondary)", textDecoration: "none" }}
        >
          ← Все товары
        </Link>
      }
      nav={
        <AdminNav current="products" role={admin.role} username={admin.username} logoutAction={logoutAction} />
      }
    >
      <ProductForm values={values} categories={categories} collections={collections} photos={[]} />
    </PageShell>
  );
}
