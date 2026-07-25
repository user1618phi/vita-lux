"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

/* CatalogAnalytics — fires view_item_list when the list (re)loads and
   catalog_filter_used whenever the applied filters change. Kept out of the
   render tree (returns null) so the grid itself stays server-rendered. */

export interface CatalogAnalyticsProps {
  listId: string;
  listName: string;
  itemCount: number;
  signature: string;
}

export function CatalogAnalytics({ listId, listName, itemCount, signature }: CatalogAnalyticsProps) {
  const firstFilter = useRef(true);

  useEffect(() => {
    track("view_item_list", { item_list_id: listId, item_list_name: listName, item_count: itemCount });
    // Re-fire when the resolved list changes (id encodes category + signature).
  }, [listId, listName, itemCount]);

  useEffect(() => {
    if (firstFilter.current) {
      firstFilter.current = false;
      return;
    }
    track("catalog_filter_used", { item_list_id: listId, result_count: itemCount, filters: signature });
  }, [signature, listId, itemCount]);

  return null;
}
