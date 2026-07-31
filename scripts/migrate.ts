/* Накат миграций.
   Запуск: DATABASE_URL="…" pnpm db:migrate

   Почему свой скрипт, а не `drizzle-kit migrate`.

   drizzle-kit сам ищет драйвер БД среди СВОИХ зависимостей, а pnpm держит
   пакеты изолированно: `postgres` лежит в node_modules пакета @vita/db, но не в
   node_modules самого drizzle-kit. Команда падает с «please install either of
   'pg', 'postgres', …», хотя драйвер установлен. Обходить это через
   shamefully-hoist или public-hoist-pattern значит ослабить изоляцию всего
   воркспейса ради одной утилиты.

   Здесь драйвер импортируется явно, и мигратор drizzle-orm получает уже готовое
   соединение. Тот же журнал `drizzle.__drizzle_migrations`, те же файлы в
   packages/db/drizzle — меняется только способ подключения.

   Отдельно: `drizzle.config.ts` читает DATABASE_URL из окружения, но
   packages/db/.env не существует и подхватить его неоткуда. Переменную всегда
   передавай явно. */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

/* Без top-level await: корневой package.json не помечен `"type": "module"`,
   поэтому tsx собирает скрипты как CJS. Тот же приём, что в seed.ts и parity.ts. */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL не задан. Пример:\n  DATABASE_URL='postgresql://…' pnpm db:migrate");
    process.exit(1);
  }

  const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "db", "drizzle");

  /* max: 1 — миграции идут строго последовательно, пул тут не нужен и мешает.
     prepare: false — обязательно за транзакционным пулером (Supabase). */
  const sql = postgres(url, { max: 1, prepare: false });

  try {
    console.log(`→ накатываю миграции из ${migrationsFolder}`);
    console.log(`  цель: ${new URL(url).host}`);
    await migrate(drizzle(sql), { migrationsFolder });
    console.log("✓ миграции применены");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("✗ миграции не применились:", (err as Error).message);
  process.exit(1);
});
