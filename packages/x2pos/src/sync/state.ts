/* Sync cursors.

   `what_is_new` tells us when the catalogue last changed upstream. Storing the
   value we last imported turns every subsequent run into a single cheap
   request that usually answers "nothing to do" — the live endpoint is 700
   bytes and answers in ~100 ms, so a five-minute poll costs nothing. */

import { eq } from "drizzle-orm";
import { schema, type Database } from "@vita/db/client";

export const CURSOR_PRODUCTS = "products.lastUpdated";
export const CURSOR_LAST_RUN = "sync.lastRunAt";
export const CURSOR_LAST_REPORT = "sync.lastReport";

export async function readState<T = unknown>(db: Database, key: string): Promise<T | null> {
  const rows = await db
    .select({ value: schema.x2posSyncState.value })
    .from(schema.x2posSyncState)
    .where(eq(schema.x2posSyncState.key, key))
    .limit(1);
  return (rows[0]?.value as T) ?? null;
}

export async function writeState(db: Database, key: string, value: unknown): Promise<void> {
  await db
    .insert(schema.x2posSyncState)
    .values({ key, value: value as object, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.x2posSyncState.key,
      set: { value: value as object, updatedAt: new Date() },
    });
}
