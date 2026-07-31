/* Stock import: the frequent, cheap half of the integration.

   One request, ~90 ms, 56 rows. It runs far more often than the catalogue sync
   because stock is the thing that goes stale dangerously: a price that is five
   minutes old costs nothing, a sold-out product that still says «в наличии»
   costs a phone call and a refund.

   Two rules that are easy to get wrong and expensive to get wrong:

     1. A variation with no row in the response has zero stock. X2pos omits
        empty rows entirely — 36 of 92 products have none. Absent is not
        "unknown", it is zero.

     2. An entirely empty response is NOT "everything is sold out". It is what
        the API returns for a branch id it does not accept, and treating it as
        real would take the whole catalogue out of stock in one run. The client
        raises on this rather than returning an empty map. */

import { and, eq, isNotNull } from "drizzle-orm";
import { schema, type Database } from "@vita/db/client";
import { X2POS_SOURCE, qtyToStockState, toQty } from "../map.ts";
import type { X2posClient } from "../client.ts";
import { emptyReport, type SyncReport } from "./report.ts";

export interface SyncStockOptions {
  db: Database;
  client: X2posClient;
  /** Units held back from the site. From `getSettings().stockBufferQty`. */
  bufferQty: number;
  dryRun?: boolean;
}

export async function syncStock(opts: SyncStockOptions): Promise<SyncReport> {
  const { db, client, bufferQty } = opts;
  const dryRun = opts.dryRun ?? false;
  const report = emptyReport(dryRun);

  const stock = await client.getStock();

  /* Every variant we own that came from X2pos, with its current stored state,
     so that an unchanged run writes nothing and revalidates nothing. */
  const rows = await db
    .select({
      variantId: schema.variant.id,
      externalId: schema.variant.externalId,
      handle: schema.product.handle,
      productStatus: schema.product.status,
      state: schema.inventory.state,
      qty: schema.inventory.qty,
    })
    .from(schema.variant)
    .innerJoin(schema.product, eq(schema.product.id, schema.variant.productId))
    .leftJoin(schema.inventory, eq(schema.inventory.variantId, schema.variant.id))
    .where(
      and(
        isNotNull(schema.variant.externalId),
        eq(schema.product.externalSource, X2POS_SOURCE),
      ),
    );

  report.productsSeen = rows.length;

  for (const row of rows) {
    if (!row.externalId) continue;

    /* Archived upstream products stay "out" regardless of what the warehouse
       says — the catalogue sync owns that decision, not this one. */
    const qty = toQty(stock.get(row.externalId));
    const state =
      row.productStatus === "archived" ? "out" : qtyToStockState(qty, bufferQty);

    if (row.state === state && row.qty === qty) continue;

    report.inventoryUpdated++;
    report.touchedHandles.push(row.handle);

    if (dryRun) continue;

    await db
      .insert(schema.inventory)
      .values({ variantId: row.variantId, state, qty, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.inventory.variantId,
        set: { state, qty, updatedAt: new Date() },
      });
  }

  report.touchedHandles = [...new Set(report.touchedHandles)];
  report.finishedAt = new Date().toISOString();
  return report;
}
