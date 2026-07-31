import "server-only";
import { revalidateTag } from "next/cache";
import { REVALIDATE_PATH } from "@vita/data/repo/tags";

/* Публикация изменений на витрину.

   Админка и витрина — разные деплойменты Vercel, поэтому локальный
   `revalidateTag` сбрасывает только кэш САМОЙ админки. Чтобы обновилась
   витрина, надо достучаться до её роута `/api/revalidate`.

   Делаем оба действия: локальный сброс стоит ноль и держит в порядке те
   страницы админки, что читают через `@vita/data`, а вебхук — то, ради чего всё
   затевалось. */

const TIMEOUT_MS = 4000;

/**
 * Сбрасывает теги локально и на витрине.
 *
 * НИКОГДА не бросает. Это главное свойство: вызов стоит после того, как запись
 * в БД уже прошла, и падение сети не должно превращаться в ошибку сохранения —
 * иначе владелец увидит «не удалось сохранить» на успешно сохранённой цене и
 * нажмёт ещё раз.
 *
 * @returns дошло ли до витрины. Вызывающий обязан показать это пользователю
 *          честно, а не рапортовать об успехе безусловно.
 */
export async function publish(tags: string[]): Promise<boolean> {
  const unique = [...new Set(tags.filter(Boolean))];
  if (unique.length === 0) return true;

  for (const tag of unique) revalidateTag(tag);

  const base = process.env.SITE_REVALIDATE_URL;
  const secret = process.env.REVALIDATE_SECRET;

  /* Локальная разработка без поднятой витрины — не ошибка. Отсутствие
     конфигурации означает «публиковать некуда», а не «публикация провалилась».
     На проде обе переменные заданы, и эта ветка не срабатывает. */
  if (!base || !secret) return true;

  try {
    const response = await fetch(new URL(REVALIDATE_PATH, base), {
      method: "POST",
      headers: { "content-type": "application/json", "x-vita-revalidate": secret },
      body: JSON.stringify({ tags: unique }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    /* Сеть, таймаут, DNS. Тег уже сброшен локально; на витрине изменение
       догонит по `revalidate: 300` из packages/data. Логировать нечего —
       payload содержит только хендлы, но правило проекта «не логируй payload»
       проще соблюдать без исключений. */
    return false;
  }
}
