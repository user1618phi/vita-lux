/* Сброс кэша витрины из обычного Node-процесса.

   Своя копия, а не `apps/admin/src/lib/revalidate.ts`: тот дёргает
   `revalidateTag` из `next/cache`, которого вне Next не существует. Локальный
   сброс воркеру и не нужен — у него нет своего кэша страниц, ему нужен только
   вебхук на витрину.

   Никогда не бросает: запись в БД к этому моменту уже прошла, и упавшая сеть
   не должна превращать успешную синхронизацию в проваленную. Худшее, что
   случится, — витрина догонит по TTL 300 секунд. */

const TIMEOUT_MS = 8_000;
/* Столько тегов принимает роут витрины за один вызов (MAX_TAGS_PER_CALL). */
const MAX_TAGS = 50;

export async function publishTags(tags: string[]): Promise<boolean> {
  const unique = [...new Set(tags.filter(Boolean))];
  if (unique.length === 0) return true;

  const base = process.env.SITE_REVALIDATE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!base || !secret) return true; // публиковать некуда — это не ошибка

  let ok = true;
  for (let i = 0; i < unique.length; i += MAX_TAGS) {
    const batch = unique.slice(i, i + MAX_TAGS);
    try {
      const res = await fetch(new URL("/api/revalidate", base), {
        method: "POST",
        headers: { "content-type": "application/json", "x-vita-revalidate": secret },
        body: JSON.stringify({ tags: batch }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      ok = res.ok && ok;
    } catch {
      ok = false;
    }
  }
  return ok;
}
