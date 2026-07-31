"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { and, eq, max } from "drizzle-orm";
import { processPhoto } from "@vita/core/image";
import { db, schema } from "@vita/db/client";
import { audit, currentAdmin } from "@/lib/auth";
import { storage } from "@vita/core/storage";
import { CATALOG_TAG, productTag } from "@vita/data/repo/tags";
import { publish } from "@/lib/revalidate";

/* Photo upload.

   Shot on a phone in the warehouse, so the input is whatever the camera
   produced — including HEIC from an iPhone. sharp is built with libheif here,
   and `accept` also nudges iOS into transcoding, but unsupported input is
   reported in plain Russian rather than failing silently. */

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const LARGE_PX = 1600;
const THUMB_PX = 400;

export async function uploadPhotosAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok?: boolean; uploaded?: number; error?: string; published?: boolean }> {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

  const productId = String(formData.get("productId") ?? "");
  const handle = String(formData.get("handle") ?? "");
  if (!productId) return { error: "Не указан товар" };

  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Выберите хотя бы одно фото" };

  const [{ value: currentMax } = { value: null }] = await db()
    .select({ value: max(schema.media.sort) })
    .from(schema.media)
    .where(eq(schema.media.productId, productId));

  let sort = (currentMax ?? -1) + 1;
  let uploaded = 0;
  const store = storage();

  for (const file of files) {
    if (file.size > MAX_BYTES) {
      return { error: `«${file.name}» больше 10 МБ — сожмите или выберите другое фото` };
    }
    if (file.type && !ACCEPTED.has(file.type)) {
      return { error: `Формат «${file.type}» не поддерживается. Нужен JPEG, PNG, WebP или HEIC.` };
    }

    const input = Buffer.from(await file.arrayBuffer());

    /* Конвейер общий с scripts/mirror-media.ts — @vita/core/image. Две копии
       означали бы два разных представления о том, каким получится фото. */
    let large: Buffer;
    let thumb: Buffer;
    let width: number;
    let height: number;
    try {
      ({ large, thumb, width, height } = await processPhoto(input));
    } catch {
      return { error: `Не удалось обработать «${file.name}». Попробуйте JPEG или PNG.` };
    }

    const id = randomUUID();
    try {
      const stored = await store.put(`${productId}/${id}.webp`, large, "image/webp");
      await store.put(`${productId}/${id}-thumb.webp`, thumb, "image/webp");

      await db().insert(schema.media).values({
        productId,
        path: stored.path,
        url: stored.url,
        width,
        height,
        kind: "photo",
        sort: sort++,
      });
      uploaded += 1;
    } catch (err) {
      return { error: `Не удалось загрузить «${file.name}»: ${(err as Error).message}` };
    }
  }

  await audit(admin.id, "media", productId, "upload", null, { count: uploaded });
  const published = await publish([CATALOG_TAG, ...(handle ? [productTag(handle)] : [])]);

  return { ok: true, uploaded, published };
}

export async function deletePhotoAction(formData: FormData) {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

  const mediaId = String(formData.get("mediaId") ?? "");
  const handle = String(formData.get("handle") ?? "");
  if (!mediaId) return;

  const [row] = await db()
    .select({ path: schema.media.path, productId: schema.media.productId })
    .from(schema.media)
    .where(eq(schema.media.id, mediaId))
    .limit(1);
  if (!row) return;

  await db().delete(schema.media).where(eq(schema.media.id, mediaId));

  const store = storage();
  await store.remove(row.path);
  await store.remove(row.path.replace(/\.webp$/, "-thumb.webp"));

  await audit(admin.id, "media", mediaId, "delete", row, null);
  await publish([CATALOG_TAG, ...(handle ? [productTag(handle)] : [])]);
}

/** Move a photo to position 0 — that is what the catalog card shows. */
export async function makeCoverAction(formData: FormData) {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

  const mediaId = String(formData.get("mediaId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const handle = String(formData.get("handle") ?? "");
  if (!mediaId || !productId) return;

  const rows = await db()
    .select({ id: schema.media.id })
    .from(schema.media)
    .where(and(eq(schema.media.productId, productId), eq(schema.media.kind, "photo")))
    .orderBy(schema.media.sort);

  const reordered = [mediaId, ...rows.map((r) => r.id).filter((id) => id !== mediaId)];
  for (const [i, id] of reordered.entries()) {
    await db().update(schema.media).set({ sort: i }).where(eq(schema.media.id, id));
  }

  await audit(admin.id, "media", mediaId, "make-cover", null, null);
  await publish([CATALOG_TAG, ...(handle ? [productTag(handle)] : [])]);
}
