/* Ручной запуск синхронизации с X2pos.
   Запуск: DATABASE_URL=… X2POS_ENABLED=1 X2POS_USER=… X2POS_PASSWORD=… \
           pnpm x2pos:sync -- --catalog --dry-run

   Флаги:
     --catalog    каталог, цены, первичные остатки
     --stock      только остатки (быстро, это же делает крон каждые 5 минут)
     --media      фотографии из X2pos в наше хранилище
     --dry-run    показать план, не записывать ничего
     --force      игнорировать курсор «наверху ничего не менялось»
     --limit=N    ограничить число картинок за прогон (по умолчанию 25)

   Зачем скрипт, если есть роуты в админке: первый импорт удобнее делать с
   машины, видя полный отчёт и имея возможность прогнать --dry-run столько раз,
   сколько нужно. Тот же приём уже применён в seed.ts и parity.ts. */

import { db } from "@vita/db/client";
import { createClient } from "@vita/x2pos/client";
import { readConfig } from "@vita/x2pos/config";
import { ensureInboxCategory, syncCatalog } from "@vita/x2pos/sync/catalog";
import { syncMedia } from "@vita/x2pos/sync/media";
import { syncStock } from "@vita/x2pos/sync/stock";
import { summarize, type SyncReport } from "@vita/x2pos/sync/report";

const argv = process.argv.slice(2);
const has = (flag: string) => argv.includes(flag);
const DRY_RUN = has("--dry-run");
const FORCE = has("--force");
const LIMIT = Number(argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 25);

/* Настройки синка живут в БД (`setting`), но читать их отсюда нельзя:
   `@vita/data/settings` помечен server-only и тянет next/cache. Значения по
   умолчанию совпадают с DEFAULTS в settings.ts. */
const MARKUP_BP = Number(process.env.X2POS_MARKUP_BP ?? 0);
const BUFFER_QTY = Number(process.env.X2POS_BUFFER_QTY ?? 3);

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL не задан");
    process.exit(1);
  }

  let config;
  try {
    config = readConfig();
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    console.error("  Нужны: X2POS_ENABLED=1, X2POS_USER, X2POS_PASSWORD,");
    console.error("  X2POS_BRANCH_ID, X2POS_KASSA_ID, X2POS_USER_ID,");
    console.error("  X2POS_EMPLOYEE_ID, X2POS_CASH_ACCOUNT_ID");
    process.exit(1);
  }

  const wantCatalog = has("--catalog");
  const wantStock = has("--stock");
  const wantMedia = has("--media");
  if (!wantCatalog && !wantStock && !wantMedia) {
    console.error("Укажи хотя бы одно: --catalog, --stock, --media");
    process.exit(1);
  }

  const d = db();
  const client = createClient({ config });

  console.log(
    `→ X2pos ${config.host}, филиал ${config.branchId}` +
      (DRY_RUN ? "  [DRY-RUN: ничего не записывается]" : ""),
  );

  let failed = false;

  if (wantCatalog) {
    /* Черновикам нужна категория, а `product.categoryId` NOT NULL. Категория
       создаётся неактивной, поэтому в навигацию витрины не попадает. */
    if (!DRY_RUN) await ensureInboxCategory(d);
    failed = report("каталог", await syncCatalog({
      db: d, client, markupBp: MARKUP_BP, bufferQty: BUFFER_QTY,
      dryRun: DRY_RUN, force: FORCE,
    })) || failed;
  }

  if (wantStock) {
    failed = report("остатки", await syncStock({
      db: d, client, bufferQty: BUFFER_QTY, dryRun: DRY_RUN,
    })) || failed;
  }

  if (wantMedia) {
    if (!DRY_RUN && process.env.STORAGE_DRIVER !== "supabase") {
      console.error("✗ STORAGE_DRIVER должен быть 'supabase': локальный драйвер пишет");
      console.error("  в public/uploads, а витрина живёт на другом домене.");
      process.exit(1);
    }
    failed = report("фото", await syncMedia({
      db: d, client, dryRun: DRY_RUN, limit: LIMIT,
    })) || failed;
  }

  console.log(
    DRY_RUN
      ? "\n✓ dry-run завершён, изменений не внесено"
      : "\n✓ синхронизация завершена",
  );
  process.exit(failed ? 1 : 0);
}

/** Печатает отчёт. Возвращает true, если были ошибки. */
function report(label: string, r: SyncReport): boolean {
  console.log(`\n── ${label} ──────────────────────────────`);
  console.log(`   ${summarize(r)}`);

  if (r.anomalies.length) {
    /* Аномалии — это не ошибки синка, а товары, которые владельцу нужно
       починить В X2pos: без цены или без фото они не продадутся. */
    const byKind = new Map<string, typeof r.anomalies>();
    for (const a of r.anomalies) {
      byKind.set(a.kind, [...(byKind.get(a.kind) ?? []), a]);
    }
    console.log("\n   Требуют внимания в X2pos:");
    for (const [kind, list] of byKind) {
      console.log(`   · ${LABELS[kind] ?? kind} — ${list.length}`);
      for (const a of list.slice(0, 5)) {
        console.log(`       ${a.vendorCode ?? "(без артикула)"} · ${a.productName}: ${a.detail}`);
      }
      if (list.length > 5) console.log(`       … и ещё ${list.length - 5}`);
    }
  }

  if (r.errors.length) {
    console.error("\n   Ошибки:");
    for (const e of r.errors.slice(0, 20)) console.error(`   ✗ ${e}`);
    if (r.errors.length > 20) console.error(`   … и ещё ${r.errors.length - 20}`);
  }
  return r.errors.length > 0;
}

const LABELS: Record<string, string> = {
  "no-price-but-in-stock": "есть на складе, но без цены",
  "wholesale-above-retail": "опт не ниже розницы",
  "no-image": "нет фото",
  "no-vendor-code": "нет артикула",
};

main().catch((err) => {
  console.error("✗ синхронизация не удалась:", (err as Error).message);
  process.exit(1);
});
