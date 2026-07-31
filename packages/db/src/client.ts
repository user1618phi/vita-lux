/* Not marked `server-only`: the CLI tooling (seed, parity, create-admin) loads
   this module outside any React context. The boundary that actually matters —
   keeping the catalog and the driver out of the browser bundle — is enforced on
   @/lib/repo, which is what pages and components import. */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/* Postgres connection.

   The client is created lazily so that importing anything from the data layer
   does not require DATABASE_URL to be set — the storefront still runs on the
   mock catalog source with no database at all, which is what keeps `pnpm dev`
   and CI working. */

let client: ReturnType<typeof postgres> | null = null;
let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function db() {
  if (database) return database;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Either configure it, or run with CATALOG_SOURCE=mock (the default).",
    );
  }

  // Small pool: serverless invocations are short-lived and Supabase/Neon pool
  // on their side. prepare:false is required behind a transaction pooler.
  client = postgres(url, { max: 5, idle_timeout: 20, prepare: false });
  database = drizzle(client, { schema });
  return database;
}

export { schema };

/* The connection type, for code that takes a database as an argument rather
   than reaching for the singleton — which is what makes the X2pos sync
   runnable from both a route handler and a CLI script. */
export type Database = ReturnType<typeof db>;
