/* Photo import: X2pos CDN → our storage.

   Deliberately a copy, not a hotlink. The X2pos bucket serves no cache
   headers, is not ours to depend on, and `next/image` cannot optimise what it
   cannot fetch at build time. The same reasoning already produced
   `scripts/mirror-media.ts`, and this reuses its exact pipeline —
   `processPhoto` from @vita/core/image, then `storage().put()`.

   Note what is NOT used: `image_thumb_url`. On the live CDN that "thumbnail"
   is larger than the original (95 KB against 83 KB), so it is worse than
   useless. We take the original and generate our own derivatives.

   Ownership rule: a `media` row with a null `externalId` was uploaded by a
   human through the admin and is never touched. Only rows this sync created
   are re-fetched, and only when the upstream URL actually changed. */

import { and, eq, isNotNull } from "drizzle-orm";
import { processPhoto } from "@vita/core/image";
import { storage } from "@vita/core/storage";
import { schema, type Database } from "@vita/db/client";
import { X2POS_SOURCE, pickImageUrl } from "../map.ts";
import type { X2posClient } from "../client.ts";
import { emptyReport, type SyncReport } from "./report.ts";

export interface SyncMediaOptions {
  db: Database;
  client: X2posClient;
  dryRun?: boolean;
  /** Cap per run, so one invocation cannot outlive a function timeout. */
  limit?: number;
}

export async function syncMedia(opts: SyncMediaOptions): Promise<SyncReport> {
  const { db, client } = opts;
  const dryRun = opts.dryRun ?? false;
  const limit = opts.limit ?? 25;
  const report = emptyReport(dryRun);

  const products = await client.listAllProducts();

  /* Everything we imported, with the cover photo the sync owns (if any). */
  const ours = await db
    .select({
      productId: schema.product.id,
      handle: schema.product.handle,
      externalId: schema.product.externalId,
      mediaId: schema.media.id,
      mediaExternalId: schema.media.externalId,
    })
    .from(schema.product)
    .leftJoin(
      schema.media,
      and(eq(schema.media.productId, schema.product.id), isNotNull(schema.media.externalId)),
    )
    .where(
      and(
        eq(schema.product.externalSource, X2POS_SOURCE),
        isNotNull(schema.product.externalId),
      ),
    );

  const byExternalId = new Map(ours.filter((r) => r.externalId).map((r) => [r.externalId!, r]));
  const store = dryRun ? null : storage();

  for (const p of products) {
    if (report.mediaImported >= limit) break;

    const row = byExternalId.get(p.product_id);
    if (!row) continue; // not imported yet — the catalogue sync runs first

    const url = pickImageUrl(p);
    if (!url) continue;
    if (row.mediaExternalId === url) continue; // unchanged, nothing to fetch

    report.productsSeen++;

    if (dryRun) {
      report.mediaImported++;
      report.touchedHandles.push(row.handle);
      continue;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`скачивание вернуло ${res.status}`);
      const processed = await processPhoto(Buffer.from(await res.arrayBuffer()));

      const base = `x2pos/${p.product_id}/0`;
      const stored = await store!.put(`${base}.webp`, processed.large, "image/webp");
      await store!.put(`${base}-thumb.webp`, processed.thumb, "image/webp");

      const values = {
        productId: row.productId,
        path: stored.path,
        url: stored.url,
        width: processed.width,
        height: processed.height,
        kind: "photo" as const,
        /* sort 0 is the cover. A human who uploads their own photo and makes
           it the cover pushes this row down, and the sync leaves it there. */
        sort: 0,
        externalId: url,
      };

      if (row.mediaId) {
        await db.update(schema.media).set(values).where(eq(schema.media.id, row.mediaId));
      } else {
        await db.insert(schema.media).values(values);
      }

      report.mediaImported++;
      report.touchedHandles.push(row.handle);
    } catch (e) {
      report.errors.push(`фото ${p.product_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  report.touchedHandles = [...new Set(report.touchedHandles)];
  report.finishedAt = new Date().toISOString();
  return report;
}
