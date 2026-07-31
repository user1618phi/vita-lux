import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { MAX_TAGS_PER_CALL, isKnownTag } from "@vita/data/repo/tags";

/* Сброс кэша витрины по запросу админки.

   Зачем это вообще: админка и витрина — два РАЗНЫХ проекта Vercel, а
   `unstable_cache` живёт внутри деплоймента. Из процесса админки дотянуться до
   кэша витрины невозможно, поэтому единственный способ — заставить нужный код
   выполниться здесь, внутри витрины. Отсюда HTTP-роут.

   Альтернативу — общий cacheHandler на Redis — не берём по той же причине, по
   которой в проекте нет Medusa и Meilisearch (см. CLAUDE.md): второй сервис,
   который надо оплачивать и держать живым, ради каталога на 55-200 SKU, плюс
   сетевой хоп на КАЖДОЕ чтение каталога вместо одного запроса на запись.

   Роут закрыт от индексации (`robots.ts` запрещает /api) и не попадает в
   next-intl: матчер middleware исключает `api`. */

export const runtime = "nodejs"; // timingSafeEqual — из node:crypto
export const dynamic = "force-dynamic";

const HEADER = "x-vita-revalidate";

/** Сравнение, не зависящее от времени. `timingSafeEqual` бросает на разной
    длине, поэтому длину проверяем отдельно — и да, она утекает, но длина
    секрета не тайна, в отличие от его содержимого. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  const expected = process.env.REVALIDATE_SECRET;

  /* Секрет не задан — это 503, а НЕ тихий успех.
     Роут, который отвечает «ок» и ничего не делает, — худший из возможных
     вариантов: админка отрапортует «сайт обновлён», цена останется старой, и
     владелец перестанет доверять инструменту. Пусть лучше видно, что сломано. */
  if (!expected) {
    return Response.json(
      { error: "REVALIDATE_SECRET is not configured on the storefront" },
      { status: 503 },
    );
  }

  const provided = request.headers.get(HEADER);
  if (!provided || !secretMatches(provided, expected)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let tags: unknown;
  try {
    ({ tags } = (await request.json()) as { tags?: unknown });
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  if (!Array.isArray(tags) || tags.length === 0) {
    return Response.json({ error: "tags must be a non-empty array" }, { status: 400 });
  }
  if (tags.length > MAX_TAGS_PER_CALL) {
    return Response.json({ error: "too many tags" }, { status: 400 });
  }

  /* Принимаем только теги, которые сами же и выдаём. Роут публичный, и
     передавать произвольные строки из сети в `revalidateTag` незачем.
     В ответ не эхоим присланное — незачем помогать подбирать. */
  const known = tags.filter((t): t is string => typeof t === "string" && isKnownTag(t));
  if (known.length !== tags.length) {
    return Response.json({ error: "unknown tag" }, { status: 400 });
  }

  for (const tag of known) revalidateTag(tag);

  return Response.json({ ok: true, revalidated: known.length });
}

/** Явный 405 вместо 404: так видно, что роут есть, но дёргают его неправильно. */
export async function GET(): Promise<Response> {
  return Response.json({ error: "method not allowed" }, { status: 405 });
}
