/* Переносит фотографии каталога из чужого CDN в собственное хранилище.
   Запуск: DATABASE_URL=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
           STORAGE_DRIVER=supabase pnpm db:media
   Флаг --dry-run — показать план без записи.

   Зачем.

   Мок-каталог отдаёт `images.unsplash.com/...` (packages/core/src/img.ts), и
   сид кладёт эти ссылки прямо в `media.url`, а в `media.path` пишет
   `mock/<handle>/<n>` — путь, за которым НЕ СТОИТ никакого объекта. Из этого
   следуют три неприятности:

     1. каталог держится на стороннем сервисе, который ничего нам не обещал;
     2. `deletePhotoAction` удаляет несуществующий ключ и делает вид, что убрал
        файл;
     3. весь путь через Supabase Storage остаётся непроверенным до того дня,
        когда владелец загрузит первое настоящее фото.

   Скрипт закрывает все три: качает картинку, прогоняет через тот же конвейер,
   что и админка (@vita/core/image), кладёт в бакет и переписывает строку.

   Идемпотентен: строки, уже указывающие в наше хранилище, пропускаются. */

import { eq, like } from "drizzle-orm";
import { db, schema } from "@vita/db/client";
import { processPhoto } from "@vita/core/image";
import { storage } from "@vita/core/storage";

const DRY_RUN = process.argv.includes("--dry-run");
const EXTERNAL = "https://images.unsplash.com/%";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL не задан");
    process.exit(1);
  }
  if (process.env.STORAGE_DRIVER !== "supabase") {
    console.error("STORAGE_DRIVER должен быть 'supabase' — локальный драйвер пишет в public/uploads,");
    console.error("а витрина живёт на другом домене и такие ссылки не откроет.");
    process.exit(1);
  }

  const d = db();
  const rows = await d
    .select({
      id: schema.media.id,
      productId: schema.media.productId,
      url: schema.media.url,
      sort: schema.media.sort,
      handle: schema.product.handle,
    })
    .from(schema.media)
    .innerJoin(schema.product, eq(schema.product.id, schema.media.productId))
    .where(like(schema.media.url, EXTERNAL))
    .orderBy(schema.media.productId, schema.media.sort);

  if (!rows.length) {
    console.log("✓ внешних ссылок не осталось — зеркалировать нечего");
    process.exit(0);
  }

  console.log(`→ найдено внешних картинок: ${rows.length}`);
  if (DRY_RUN) {
    for (const r of rows) console.log(`  · ${r.handle} #${r.sort}`);
    console.log("✓ dry-run: изменений не внесено");
    process.exit(0);
  }

  const store = storage();

  /* Мок переиспользует одни и те же снимки в разных товарах. Качаем и
     обрабатываем каждый исходник один раз, а в бакет кладём копию на строку —
     иначе удаление фото у одного товара утащило бы картинку у другого. */
  const processedCache = new Map<string, Awaited<ReturnType<typeof processPhoto>>>();
  let done = 0;
  let failed = 0;

  for (const r of rows) {
    try {
      let processed = processedCache.get(r.url);
      if (!processed) {
        const res = await fetch(r.url);
        if (!res.ok) throw new Error(`скачивание вернуло ${res.status}`);
        processed = await processPhoto(Buffer.from(await res.arrayBuffer()));
        processedCache.set(r.url, processed);
      }

      const base = `mock/${r.handle}/${r.sort}`;
      const stored = await store.put(`${base}.webp`, processed.large, "image/webp");
      await store.put(`${base}-thumb.webp`, processed.thumb, "image/webp");

      await d
        .update(schema.media)
        .set({
          path: stored.path,
          url: stored.url,
          width: processed.width,
          height: processed.height,
        })
        .where(eq(schema.media.id, r.id));

      done += 1;
      console.log(`  ✓ ${r.handle} #${r.sort} → ${stored.path}`);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${r.handle} #${r.sort}: ${(err as Error).message}`);
    }
  }

  console.log(`✓ перенесено ${done}, уникальных исходников ${processedCache.size}${failed ? `, ошибок ${failed}` : ""}`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("✗ зеркалирование не удалось:", (err as Error).message);
  process.exit(1);
});
