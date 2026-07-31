/* What a sync run did, in a shape both the admin screen and the CLI can render.

   Every run produces one of these even when it changes nothing, because "the
   sync ran and found nothing to do" and "the sync did not run" are different
   situations and the difference matters when stock looks wrong. */

import type { Anomaly } from "../map.ts";

export interface SyncReport {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  /** True when the run stopped early because nothing changed upstream. */
  skipped: boolean;
  skipReason?: string;

  productsSeen: number;
  productsCreated: number;
  productsUpdated: number;
  productsArchived: number;

  pricesWritten: number;
  /** Variants left alone because an admin's manual price is in force. */
  pricesSkippedManual: number;

  inventoryUpdated: number;
  mediaImported: number;

  anomalies: Anomaly[];
  /** Product handles whose cached pages need invalidating. */
  touchedHandles: string[];
  errors: string[];
}

export function emptyReport(dryRun: boolean): SyncReport {
  const now = new Date().toISOString();
  return {
    startedAt: now,
    finishedAt: now,
    dryRun,
    skipped: false,
    productsSeen: 0,
    productsCreated: 0,
    productsUpdated: 0,
    productsArchived: 0,
    pricesWritten: 0,
    pricesSkippedManual: 0,
    inventoryUpdated: 0,
    mediaImported: 0,
    anomalies: [],
    touchedHandles: [],
    errors: [],
  };
}

/** Human-readable summary for a log line or the admin screen. */
export function summarize(r: SyncReport): string {
  if (r.skipped) return `пропущено: ${r.skipReason ?? "нет изменений"}`;
  const parts = [
    `просмотрено ${r.productsSeen}`,
    `создано ${r.productsCreated}`,
    `обновлено ${r.productsUpdated}`,
  ];
  if (r.productsArchived) parts.push(`архив ${r.productsArchived}`);
  if (r.pricesWritten) parts.push(`цен ${r.pricesWritten}`);
  if (r.pricesSkippedManual) parts.push(`ручных цен сохранено ${r.pricesSkippedManual}`);
  if (r.inventoryUpdated) parts.push(`остатков ${r.inventoryUpdated}`);
  if (r.mediaImported) parts.push(`фото ${r.mediaImported}`);
  if (r.anomalies.length) parts.push(`аномалий ${r.anomalies.length}`);
  if (r.errors.length) parts.push(`ошибок ${r.errors.length}`);
  return (r.dryRun ? "[dry-run] " : "") + parts.join(", ");
}
