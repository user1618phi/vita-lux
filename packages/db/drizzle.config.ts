import type { Config } from "drizzle-kit";

/* Пути относительны этому пакету: схема и миграции переехали сюда вместе,
   чтобы `db:generate` нельзя было запустить из приложения и сложить миграции
   не туда, где их потом ищет `db:migrate`. */

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
} satisfies Config;
