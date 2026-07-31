"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { audit, currentAdmin } from "@/lib/auth";

/* Запуск обмена из панели.

   Раньше экран X2pos умел только смотреть: расписание живёт в воркере на
   Railway, и «обновить сейчас» сделать было нечем. Здесь панель просто стучит
   в тот же воркер тем же секретом, которым ходит крон.

   Долгие задания (каталог с картинками) идут минутами, поэтому ответ не ждём
   дольше таймаута: воркер продолжит работу и без нас, а отчёт подтянется на
   следующем обновлении страницы. */

const JOBS = new Set(["stock", "catalog", "media", "outbox"]);
const TIMEOUT_MS = 25_000;

export async function runSyncAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string; summary?: string }> {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

  const job = String(formData.get("job") ?? "");
  if (!JOBS.has(job)) return { error: "Неизвестное задание" };

  const base = process.env.X2POS_WORKER_URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    return {
      error: "Не настроено: нужны X2POS_WORKER_URL и CRON_SECRET в переменных окружения админки.",
    };
  }

  await audit(admin.id, "x2pos", job, "sync.trigger", null, null);

  try {
    const res = await fetch(new URL(`/run/${job}`, base), {
      method: "POST",
      headers: { "x-vita-cron": secret },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { error: `Воркер ответил ${res.status}` };
    const body = (await res.json()) as { summary?: string };
    revalidatePath("/sync");
    return { ok: true, summary: body.summary ?? "Готово" };
  } catch {
    /* Тела не логируем: в очереди заказы. */
    return {
      ok: true,
      summary: "Задание запущено. Ответ идёт дольше ожидания — отчёт появится после обновления.",
    };
  }
}
