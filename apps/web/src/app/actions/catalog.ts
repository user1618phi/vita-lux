"use server";

import { getLocale } from "next-intl/server";
import { resolveLines } from "@vita/data/repo";

/* Server-side resolution of handles the browser holds in localStorage.

   The cart and the favorites list only ever persist handles plus a display
   snapshot. Prices, names and stock are re-read here on every mount, so a
   stale snapshot can never be what the customer checks out against — and the
   client never needs to import the catalog (or the database driver). */

export interface LineSnapshot {
  handle: string;
  sku: string;
  name: string;
  price: number;
  oldPrice?: number;
  image?: string;
  gallery?: string[];
  collection: string;
  stock: "in" | "order" | "out";
  priceOnRequest: boolean;
  badge?: "hit" | "sale" | "new";
  installmentMonths: number;
}

export interface ResolveResult {
  /** Snapshots for handles that still exist, in the order requested. */
  found: LineSnapshot[];
  /** Handles no longer in the catalog. The UI must say so, not drop them silently. */
  missing: string[];
}

function toSnapshot(item: Awaited<ReturnType<typeof resolveLines>>[number]["item"]): LineSnapshot {
  return {
    handle: item.handle,
    sku: item.sku,
    name: item.name,
    price: item.price,
    oldPrice: item.oldPrice,
    image: item.image,
    gallery: item.gallery,
    collection: item.collection,
    stock: item.stock,
    priceOnRequest: item.priceOnRequest,
    badge: item.badge,
    installmentMonths: item.installmentMonths,
  };
}

/** Resolve a list of handles to fresh display data. */
export async function resolveHandles(handles: string[]): Promise<ResolveResult> {
  if (!handles.length) return { found: [], missing: [] };

  // Cap the request: a handcrafted localStorage payload should not be able to
  // turn one page load into an unbounded query.
  const unique = [...new Set(handles)].slice(0, 200);
  const locale = await getLocale();

  const resolved = await resolveLines(
    unique.map((handle) => ({ handle, qty: 1 })),
    locale,
  );

  const found = resolved.map((line) => toSnapshot(line.item));
  const foundHandles = new Set(found.map((f) => f.handle));

  return { found, missing: unique.filter((h) => !foundHandles.has(h)) };
}
