/* Воркер синхронизации с X2pos.

   Живёт на Railway, а не на Vercel, по двум причинам, и обе упираются в тариф
   Hobby: Vercel Cron там умеет запускать задачу раз в сутки (остатки нужны
   каждые пять минут), а serverless-функция ограничена десятью секундами —
   полный импорт каталога с картинками в них не укладывается. Обычный
   долгоживущий Node-процесс не знает ни того, ни другого ограничения.

   Расписание внутри процесса, а не четырьмя отдельными cron-сервисами: так
   между заданиями можно держать блокировку. Синк остатков и разбор очереди
   заказов ходят в одну и ту же таблицу `inventory`, и одновременный запуск
   двух прогонов ничего хорошего не даёт.

   HTTP-сервер нужен для двух вещей: healthcheck Railway и кнопка «обновить
   сейчас» из админки. */

import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { isX2posEnabled } from "@vita/x2pos/config";
import { JOB_NAMES, runJob, type JobName } from "./jobs.ts";

const PORT = Number(process.env.PORT ?? 8080);

/* Интервалы. Остатки — самое быстрое и самое важное: цена, устаревшая на
   пятнадцать минут, не стоит ничего, а проданный товар, который на витрине
   всё ещё «в наличии», стоит звонка и извинений. */
const SCHEDULE: Record<JobName, number> = {
  stock: 5 * 60_000,
  outbox: 5 * 60_000,
  /* Справочники для админки: продажи, клиенты, счета, документы. Десять минут
     — компромисс между свежестью дашборда и нагрузкой на X2pos. Цифры на
     панели показываются с отметкой возраста, так что задержка честная. */
  mirror: 10 * 60_000,
  catalog: 15 * 60_000,
  media: 60 * 60_000,
};

/* Одно задание за раз на весь процесс. */
let busy = false;
const lastRun = new Map<JobName, { at: string; ok: boolean; summary: string }>();

async function run(job: JobName, opts: { force?: boolean } = {}): Promise<string> {
  if (!isX2posEnabled()) return "X2POS_ENABLED не равен «1» — пропуск";
  if (busy) return "занят другим заданием — пропуск";

  busy = true;
  try {
    const r = await runJob(job, opts);
    lastRun.set(job, { at: new Date().toISOString(), ok: r.ok, summary: r.summary });
    log(`${job}: ${r.summary} (${r.durationMs} мс)`);
    return r.summary;
  } finally {
    busy = false;
  }
}

function log(message: string): void {
  /* Только счётчики и имена заданий. Ни payload заказов, ни персональных
     данных — правило то же, что и на сайте. */
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function authorized(req: { headers: Record<string, string | string[] | undefined> }): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers["x-vita-cron"];
  const auth = req.headers["authorization"];
  const provided =
    (typeof header === "string" ? header : undefined) ??
    (typeof auth === "string" ? auth.replace(/^Bearer\s+/i, "") : "") ??
    "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const json = (code: number, body: unknown) => {
    res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body));
  };

  /* Healthcheck открыт: Railway дёргает его без заголовков. Ничего, кроме
     факта «процесс жив» и времени последних прогонов, он не выдаёт. */
  if (url.pathname === "/health") {
    return json(200, {
      ok: true,
      x2pos: isX2posEnabled(),
      busy,
      lastRun: Object.fromEntries(lastRun),
    });
  }

  const match = url.pathname.match(/^\/run\/([a-z]+)$/);
  if (match) {
    if (!authorized(req)) return json(401, { error: "unauthorized" });
    const job = match[1] as JobName;
    if (!JOB_NAMES.includes(job)) return json(404, { error: "unknown job" });
    const summary = await run(job, { force: url.searchParams.get("force") === "1" });
    return json(200, { ok: true, job, summary });
  }

  return json(404, { error: "not found" });
});

server.listen(PORT, () => {
  log(`воркер слушает :${PORT}, X2pos ${isX2posEnabled() ? "включён" : "ВЫКЛЮЧЕН"}`);

  if (!isX2posEnabled()) {
    log("расписание не запущено: задайте X2POS_ENABLED=1");
    return;
  }

  for (const [job, everyMs] of Object.entries(SCHEDULE) as [JobName, number][]) {
    /* Разводим старты по времени, чтобы после деплоя все четыре задания не
       ударили в X2pos одновременно. */
    const offset = JOB_NAMES.indexOf(job) * 20_000;
    setTimeout(() => {
      void run(job);
      setInterval(() => void run(job), everyMs);
    }, offset);
  }
  log("расписание: остатки и очередь 5 мин, зеркало 10, каталог 15, фото 60");
});

/* Railway останавливает контейнер сигналом. Даём текущему заданию завершиться,
   иначе прогон может оборваться на середине записи цен. */
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    log(`${signal}: завершаем работу`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 15_000).unref();
  });
}
