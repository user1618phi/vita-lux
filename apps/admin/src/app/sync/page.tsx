import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@vita/db/client";
import { isX2posEnabled } from "@vita/x2pos/config";
import { listDrafts } from "@vita/x2pos/sync/catalog";
import { CURSOR_LAST_REPORT, CURSOR_LAST_RUN, readState } from "@vita/x2pos/sync/state";
import type { SyncReport } from "@vita/x2pos/sync/report";
import { currentAdmin } from "@/lib/auth";
import { ErrorBox } from "../ui";
import { AppShell, Empty, Panel, Section } from "@/components/AppShell";
import { RunButtons } from "./RunButtons";

export const dynamic = "force-dynamic";

/* Состояние интеграции со складом.

   Страница отвечает на три вопроса, которые возникают, когда на сайте что-то
   выглядит не так: когда синк работал в последний раз, какие товары ждут
   заполнения руками, и что застряло по дороге в X2pos. Без неё единственный
   способ это узнать — лезть в логи Vercel. */

const KIND_LABELS: Record<string, string> = {
  catalog: "Каталог и цены",
  stock: "Остатки",
  media: "Фотографии",
};

const ANOMALY_LABELS: Record<string, string> = {
  "no-price-but-in-stock": "Есть на складе, но без цены",
  "wholesale-above-retail": "Опт не ниже розницы",
  "no-image": "Нет фото",
  "no-vendor-code": "Нет артикула",
};

export default async function SyncPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

  const d = db();
  const [lastRun, catalogReport, stockReport, drafts, stuck] = await Promise.all([
    readState<{ kind: string; at: string }>(d, CURSOR_LAST_RUN),
    readState<SyncReport>(d, `${CURSOR_LAST_REPORT}.catalog`),
    readState<SyncReport>(d, `${CURSOR_LAST_REPORT}.stock`),
    listDrafts(d),
    d
      .select({
        id: schema.x2posOutbox.id,
        kind: schema.x2posOutbox.kind,
        attempts: schema.x2posOutbox.attempts,
        lastError: schema.x2posOutbox.lastError,
        refCode: schema.order.refCode,
      })
      .from(schema.x2posOutbox)
      .innerJoin(schema.order, eq(schema.order.id, schema.x2posOutbox.orderId))
      .where(isNull(schema.x2posOutbox.doneAt))
      .orderBy(desc(schema.x2posOutbox.attempts))
      .limit(20),
  ]);

  const anomalies = catalogReport?.anomalies ?? [];
  const byKind = new Map<string, typeof anomalies>();
  for (const a of anomalies) byKind.set(a.kind, [...(byKind.get(a.kind) ?? []), a]);

  return (
    <AppShell
      title="Обмен с X2pos"
      subtitle="Расписание держит воркер на Railway: остатки и очередь каждые 5 минут, каталог 15, фото раз в час."
    >
      <Section title="Запустить сейчас" hint="Не дожидаясь расписания. Одновременно выполняется одно задание.">
        <Panel>
          <div className="p-4">
            <RunButtons />
          </div>
        </Panel>
      </Section>

      {!isX2posEnabled() ? (
        <ErrorBox>
          Интеграция выключена: переменная X2POS_ENABLED не равна «1». Сайт работает на данных из
          своей базы, заказы в X2pos не уходят и копятся в очереди.
        </ErrorBox>
      ) : null}

      <Section title="Последний обмен">
        <dl className="m-0 grid gap-x-6 gap-y-2 [grid-template-columns:auto_1fr]">
          <Row label="Когда" value={lastRun ? `${formatWhen(lastRun.at)} · ${KIND_LABELS[lastRun.kind] ?? lastRun.kind}` : "ещё не было"} />
          {catalogReport ? (
            <Row
              label="Каталог"
              value={
                catalogReport.skipped
                  ? (catalogReport.skipReason ?? "без изменений")
                  : `создано ${catalogReport.productsCreated}, обновлено ${catalogReport.productsUpdated}, цен ${catalogReport.pricesWritten}` +
                    (catalogReport.pricesSkippedManual
                      ? `, ручных цен сохранено ${catalogReport.pricesSkippedManual}`
                      : "")
              }
            />
          ) : null}
          {stockReport ? (
            <Row label="Остатки" value={`изменено позиций: ${stockReport.inventoryUpdated}`} />
          ) : null}
        </dl>
        {catalogReport?.errors?.length ? (
          <div className="mt-3">
            <ErrorBox>
              {catalogReport.errors.slice(0, 5).map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </ErrorBox>
          </div>
        ) : null}
      </Section>

      <Section
        title={`Ждут заполнения — ${drafts.length}`}
        hint="Товары приехали из X2pos как черновики. На сайте их не видно, пока не заданы название, категория и адрес страницы. Названия из X2pos для витрины не годятся: 36 позиций там называются просто «Унитаз»."
      >
        {drafts.length === 0 ? (
          <EmptyText>Все товары из X2pos заполнены.</EmptyText>
        ) : (
          <ul className="m-0 list-none p-0">
            {drafts.slice(0, 40).map((p) => (
              <li key={p.id} className="border-b py-2 last:border-b-0" style={{ borderColor: "var(--border-control)" }}>
                <a href={`/products/${p.id}`} style={{ color: "var(--text-primary)" }}>
                  {p.baseArticle ?? p.handle}
                </a>
              </li>
            ))}
            {drafts.length > 40 ? <li className="py-2" style={{ color: "var(--text-secondary)" }}>…и ещё {drafts.length - 40}</li> : null}
          </ul>
        )}
      </Section>

      <Section
        title={`Починить в X2pos — ${anomalies.length}`}
        hint="Это не ошибки обмена. Это товары, которые не продадутся, пока их не поправят в самом X2pos — сайт не может показать больше, чем там заведено."
      >
        {anomalies.length === 0 ? (
          <EmptyText>Замечаний нет.</EmptyText>
        ) : (
          [...byKind.entries()].map(([kind, list]) => (
            <div key={kind} className="mb-3">
              <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                {ANOMALY_LABELS[kind] ?? kind} — {list.length}
              </div>
              <ul className="m-0 list-none p-0" style={{ color: "var(--text-secondary)" }}>
                {list.slice(0, 8).map((a, i) => (
                  <li key={i} className="py-1">
                    {a.vendorCode ?? "без артикула"} · {a.productName} — {a.detail}
                  </li>
                ))}
                {list.length > 8 ? <li className="py-1">…и ещё {list.length - 8}</li> : null}
              </ul>
            </div>
          ))
        )}
      </Section>

      <Section
        title={`Не доехало в X2pos — ${stuck.length}`}
        hint="Заказы, которые сайт принял, но склад ещё не получил. Самая частая причина — закрытая смена на кассе: пока её не откроют, продажу создать нельзя."
      >
        {stuck.length === 0 ? (
          <EmptyText>Очередь пуста — всё передано.</EmptyText>
        ) : (
          <ul className="m-0 list-none p-0">
            {stuck.map((s) => (
              <li key={s.id} className="border-b py-2 last:border-b-0" style={{ borderColor: "var(--border-control)" }}>
                <span style={{ color: "var(--text-primary)" }}>
                  {s.refCode} · {s.kind === "sale" ? "продажа" : "возврат"}
                </span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {" "}— попыток {s.attempts}
                  {s.lastError ? `: ${s.lastError}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section
        title="Журнал действий"
        hint="Кто и что менял. Персональных данных здесь нет: в журнал пишутся счётчики и имена полей, но никогда значения."
      >
        <Panel>
          <AuditLog />
        </Panel>
      </Section>
    </AppShell>
  );
}


function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt style={{ color: "var(--text-secondary)" }}>{label}</dt>
      <dd className="m-0" style={{ color: "var(--text-primary)" }}>
        {value}
      </dd>
    </>
  );
}


function formatWhen(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 px-4 pb-4" style={{ color: "var(--text-secondary)" }}>
      {children}
    </p>
  );
}

/* ── журнал действий ───────────────────────────────────────────────────── */

/* `audit_log` писался с самого начала и не читался нигде: каждая правка цены,
   каждое открытие карточки с персональными данными, каждый прогон обмена
   оставляли строку, которую невозможно было увидеть. Журнал, в который нельзя
   заглянуть, не выполняет ни одной из своих задач.

   Расшифрованных ПД здесь нет и быть не может — правило соблюдается на
   стороне записи: в `before_json`/`after_json` кладут счётчики и имена полей,
   но не значения. */
export async function AuditLog() {
  const rows = await db()
    .select({
      id: schema.auditLog.id,
      entity: schema.auditLog.entity,
      entityId: schema.auditLog.entityId,
      action: schema.auditLog.action,
      at: schema.auditLog.at,
      after: schema.auditLog.afterJson,
      who: schema.adminUser.username,
    })
    .from(schema.auditLog)
    .leftJoin(schema.adminUser, eq(schema.adminUser.id, schema.auditLog.adminUserId))
    .orderBy(desc(schema.auditLog.at))
    .limit(40);

  if (rows.length === 0) {
    return (
      <p className="m-0 px-4 py-6" style={{ color: "var(--text-secondary)" }}>
        Пока пусто.
      </p>
    );
  }

  return (
    <ul className="m-0 list-none p-0">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span style={{ fontSize: "var(--text-body-s)", color: "var(--text-primary)" }}>
            {ACTION_LABEL[`${r.entity}.${r.action}`] ?? `${r.entity} · ${r.action}`}
            {r.who ? (
              <span style={{ color: "var(--text-secondary)" }}> · {r.who}</span>
            ) : (
              <span style={{ color: "var(--text-secondary)" }}> · система</span>
            )}
          </span>
          <span className="vl-mono shrink-0" style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
            {summarizeAudit(r.after)}
            {"  "}
            {formatWhen(r.at.toISOString())}
          </span>
        </li>
      ))}
    </ul>
  );
}

const ACTION_LABEL: Record<string, string> = {
  "x2pos.sync.run": "Обмен выполнен",
  "x2pos.sync.skipped": "Обмен: изменений не было",
  "x2pos.sync.trigger": "Обмен запущен вручную",
  "product.create": "Товар создан",
  "product.update": "Товар изменён",
  "product.visibility": "Видимость товара изменена",
  "product.bulk-publish": "Товары опубликованы пакетно",
  "variant.bulk-update": "Цены и наличие изменены",
  "media.upload": "Загружены фотографии",
  "media.delete": "Фотография удалена",
  "media.make-cover": "Выбрана обложка",
  "order.status": "Статус заказа изменён",
  "order.note": "Заметка к заказу",
  "order.pii-view": "Открыты данные покупателя",
  "order.x2pos.return": "Возврат в X2pos",
  "admin_user.password-change": "Смена пароля",
};

/* Из json показываем только счётчики — это ровно то, что туда кладут. */
function summarizeAudit(after: unknown): string {
  if (!after || typeof after !== "object") return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(after as Record<string, unknown>)) {
    if (typeof v === "number" && v > 0) parts.push(`${k} ${v}`);
  }
  return parts.slice(0, 3).join(" · ");
}
