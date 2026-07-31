/* Задания синхронизации: одно место, где решается, что и как запускается.

   Отдельно от расписания (`index.ts`), потому что каждое задание должно
   одинаково работать и по таймеру, и по ручному запуску из админки. */

import { db, schema } from "@vita/db/client";
import { parseSettings, type StoreSettings } from "@vita/data/settings.keys";
import { CATALOG_TAG, productTag } from "@vita/data/repo/tags";
import { createClient, type X2posClient } from "@vita/x2pos/client";
import { readConfig } from "@vita/x2pos/config";
import { ensureInboxCategory, syncCatalog } from "@vita/x2pos/sync/catalog";
import { syncMedia } from "@vita/x2pos/sync/media";
import { syncStock } from "@vita/x2pos/sync/stock";
import { processOutbox } from "@vita/x2pos/sync/outbox";
import { summarize, type SyncReport } from "@vita/x2pos/sync/report";
import { CURSOR_LAST_REPORT, CURSOR_LAST_RUN, writeState } from "@vita/x2pos/sync/state";
import { publishTags } from "./revalidate.ts";

export type JobName = "stock" | "catalog" | "media" | "outbox";
export const JOB_NAMES: JobName[] = ["stock", "catalog", "media", "outbox"];

export interface JobResult {
  job: JobName;
  ok: boolean;
  summary: string;
  durationMs: number;
}

function client(): X2posClient {
  return createClient({ config: readConfig() });
}

async function settings(): Promise<StoreSettings> {
  const rows = await db().select().from(schema.setting);
  return parseSettings(rows);
}

/** Сброс кэша витрины по итогам прогона + запись отчёта для админки. */
async function finish(job: JobName, report: SyncReport, catalogChanged: boolean): Promise<void> {
  const d = db();
  await writeState(d, CURSOR_LAST_RUN, { kind: job, at: new Date().toISOString() });
  await writeState(d, `${CURSOR_LAST_REPORT}.${job}`, report as unknown);

  const tags = [...new Set(report.touchedHandles)].map(productTag);
  if (catalogChanged && tags.length) tags.unshift(CATALOG_TAG);
  if (tags.length) await publishTags(tags);

  /* Прогон синка — это мутация каталога, пусть и без человека. В журнале
     только счётчики, персональных данных здесь нет. */
  await d.insert(schema.auditLog).values({
    entity: "x2pos",
    entityId: job,
    action: report.skipped ? "sync.skipped" : "sync.run",
    afterJson: {
      created: report.productsCreated,
      updated: report.productsUpdated,
      archived: report.productsArchived,
      prices: report.pricesWritten,
      inventory: report.inventoryUpdated,
      media: report.mediaImported,
      anomalies: report.anomalies.length,
      errors: report.errors.length,
    },
  });
}

export async function runJob(job: JobName, opts: { force?: boolean } = {}): Promise<JobResult> {
  const started = Date.now();
  const d = db();

  try {
    switch (job) {
      case "stock": {
        const s = await settings();
        const report = await syncStock({ db: d, client: client(), bufferQty: s.stockBufferQty });
        await finish(job, report, report.inventoryUpdated > 0);
        return done(job, started, report.errors.length === 0, summarize(report));
      }
      case "catalog": {
        const s = await settings();
        await ensureInboxCategory(d);
        const report = await syncCatalog({
          db: d,
          client: client(),
          markupBp: s.globalMarkupBp,
          bufferQty: s.stockBufferQty,
          force: opts.force,
        });
        await finish(job, report, true);
        return done(job, started, report.errors.length === 0, summarize(report));
      }
      case "media": {
        const report = await syncMedia({ db: d, client: client(), limit: 25 });
        await finish(job, report, report.mediaImported > 0);
        return done(job, started, report.errors.length === 0, summarize(report));
      }
      case "outbox": {
        const r = await processOutbox({ db: d, client: client() });
        /* Ошибки очереди НЕ печатаем целиком: в ней лежат заказы, а payload
           заказа проект не логирует ни при каких обстоятельствах. Считаем. */
        const parts = [`обработано ${r.processed}`, `доставлено ${r.delivered}`];
        if (r.failed) parts.push(`ошибок ${r.failed}`);
        if (r.blockedByShift) parts.push(`ждут открытия смены ${r.blockedByShift}`);
        return done(job, started, r.failed === 0, parts.join(", "));
      }
    }
  } catch (e) {
    return done(job, started, false, e instanceof Error ? e.message : String(e));
  }
}

function done(job: JobName, started: number, ok: boolean, summary: string): JobResult {
  return { job, ok, summary, durationMs: Date.now() - started };
}
