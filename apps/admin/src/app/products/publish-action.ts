"use server";

import { inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@vita/db/client";
import { CATALOG_TAG, productTag } from "@vita/data/repo/tags";
import { audit, currentAdmin } from "@/lib/auth";
import { publish } from "@/lib/revalidate";
import { redirect } from "next/navigation";
import { checksFor, listProducts, publishable } from "./readiness";

export async function publishReadyAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string; published?: boolean; count?: number }> {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

  const ids = String(formData.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return { error: "Нечего публиковать" };

  /* Готовность перепроверяется на сервере по тем же правилам, а не берётся из
     формы. Список id пришёл из браузера, и между отрисовкой и нажатием товар
     мог потерять цену — публиковать его тогда нельзя. */
  const all = await listProducts();
  const allowed = all.filter(
    (p) => ids.includes(p.productId) && p.status === "draft" && publishable(checksFor(p)),
  );
  if (allowed.length === 0) return { error: "Ни один товар больше не проходит проверку" };

  await db()
    .update(schema.product)
    .set({ status: "active", updatedAt: new Date() })
    .where(
      inArray(
        schema.product.id,
        allowed.map((p) => p.productId),
      ),
    );

  await audit(admin.id, "product", null, "bulk-publish", null, { count: allowed.length });

  /* Витрина живёт отдельным деплойментом — без этого вызова опубликованные
     товары не появятся на сайте до истечения TTL в пять минут. */
  const published = await publish([CATALOG_TAG, ...allowed.map((p) => productTag(p.handle))]);
  revalidatePath("/products");

  return { ok: true, count: allowed.length, published };
}
