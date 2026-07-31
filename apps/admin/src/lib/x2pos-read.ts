import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@vita/x2pos/client";
import { isX2posEnabled, readConfig } from "@vita/x2pos/config";
import { toKzt, toQty } from "@vita/x2pos/map";

/* Чтение X2pos для админки.

   Два правила, и оба важнее удобства.

   ПЕРВОЕ: ни один экран не падает из-за X2pos. Он внешний сервис, и когда он
   недоступен, панель обязана показать «данные не получены» и остаться
   работоспособной в остальном. Поэтому каждая функция возвращает
   `Result<T>` — либо данные, либо причина, — и никогда не бросает.

   ВТОРОЕ: кэш. Страницы админки `force-dynamic`, и без кэша каждый рендер
   Сводки означал бы шесть запросов в X2pos. Держим 60 секунд: свежее, чем
   любой отчёт, и на порядок дешевле.

   Ловушка API, на которую легко напороться: `/api/customers` ИГНОРИРУЕТ
   параметр `page` — вторая и третья страницы отдают тех же 33 клиентов, что
   и первая. Пагинацию по клиентам строить нельзя, проверено на боевом
   аккаунте. */

export type Result<T> = { ok: true; data: T } | { ok: false; reason: string };

const TTL = 60;

/** Обёртка: кэш + гарантия, что наружу не вылетит исключение. */
function cached<T>(key: string, load: () => Promise<T>) {
  const run = unstable_cache(
    async (): Promise<Result<T>> => {
      if (!isX2posEnabled()) return { ok: false, reason: "Интеграция с X2pos выключена" };
      try {
        return { ok: true, data: await load() };
      } catch (e) {
        /* Тела запросов не логируем — в продажах персональные данные. */
        return { ok: false, reason: e instanceof Error ? e.message : "X2pos недоступен" };
      }
    },
    ["x2pos-read", key],
    { revalidate: TTL, tags: [`x2pos:${key}`] },
  );
  return run;
}

function client() {
  return createClient({ config: readConfig() });
}

/* ── продажи ───────────────────────────────────────────────────────────── */

export interface Sale {
  id: string;
  date: string;
  total: number;
  paid: number;
  status: string;
  /** Возврат, а не продажа: в выручку не идёт. */
  isReturn: boolean;
  /** true — продажа пришла с сайта (channel = наш), иначе магазин. */
  fromSite: boolean;
  customerName: string | null;
  items: { name: string; vendorCode: string | null; qty: number; total: number }[];
}

export const getSales = cached("sales", async (): Promise<Sale[]> => {
  const c = client();
  const channel = c.config.channel.toLowerCase();
  const out: Sale[] = [];

  /* Пагинация по 50. Потолок в 20 страниц — предохранитель от бесконечного
     цикла, а не ограничение выборки: на боевом аккаунте продаж 111. Когда их
     станет за тысячу, дешевле будет зеркалить продажи в свою базу отдельным
     джобом, чем тянуть их живьём на каждый рендер. */
  for (let page = 1; page <= 20; page++) {
    const rows = await c.listOrders(page);
    if (rows.length === 0) break;
    for (const r of rows) {
      if (r.is_deleted === "1") continue;
      out.push({
        id: r.id,
        date: r.order_date ?? "",
        total: Number(r.total ?? 0),
        paid: Number(r.total_paid ?? 0),
        status: r.status ?? "",
        isReturn: r.is_return === "1",
        fromSite: (r.channel ?? "").toLowerCase() === channel,
        customerName: r.customer_name || null,
        items: Object.values(r.order_items ?? {}).map((it) => ({
          name: (it.product_name ?? "—").trim() || "—",
          vendorCode: it.product_vendor_code || null,
          qty: Number(it.quantity ?? 0),
          total: Number(it.total ?? 0),
        })),
      });
    }
  }
  return out;
});

/* ── клиенты и долги ───────────────────────────────────────────────────── */

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  /** Положительное число — столько клиент должен. */
  debt: number;
}

export const getCustomers = cached("customers", async (): Promise<Customer[]> => {
  /* Одна страница и есть весь список — см. про `page` в шапке файла. */
  const rows = await client().listCustomers();
  return rows
    .map((r) => ({
      id: r.id,
      name: (r.customer_name || r.company_name || "Без имени").trim(),
      phone: r.tel ?? null,
      city: r.kato_text ?? null,
      /* В X2pos долг клиента хранится отрицательным. Наружу отдаём
         положительное «сколько должен» — так его читают и сравнивают. */
      debt: Math.max(0, -Number(r.debt ?? 0)),
    }))
    .sort((a, b) => b.debt - a.debt);
});

/* ── денежные счета ────────────────────────────────────────────────────── */

export interface Account {
  id: string;
  name: string;
  type: string;
  amount: number;
  currency: string;
}

export const getAccounts = cached("accounts", async (): Promise<Account[]> => {
  const rows = await client().listAccounts();
  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      amount: Number(r.amount ?? 0),
      currency: r.currency ?? "KZT",
    }))
    .sort((a, b) => b.amount - a.amount);
});

/* ── документы склада ──────────────────────────────────────────────────── */

export interface Doc {
  id: string;
  action: string;
  status: string;
  date: string;
  quantity: number;
  amount: number;
  supplier: string | null;
  items: number;
}

const ACTION_LABEL: Record<string, string> = {
  acceptance: "Приёмка",
  move: "Перемещение",
  writeoff: "Списание",
  revision: "Ревизия",
};

export const getDocs = cached("procurements", async (): Promise<Doc[]> => {
  const rows = await client().listProcurements();
  return rows
    .map((r) => ({
      id: r.id,
      action: ACTION_LABEL[r.action] ?? r.action,
      status: r.status,
      date: (r.procurement_date ?? "").slice(0, 10),
      quantity: Number(r.total_quantity ?? 0),
      amount: Number(r.total_amount ?? 0),
      supplier: r.supplier_name || null,
      items: Object.keys(r.procurement_items ?? {}).length,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
});

/* ── остатки ───────────────────────────────────────────────────────────── */

export const getStock = cached("stock", async (): Promise<Record<string, number>> => {
  const map = await client().getStock();
  return Object.fromEntries(map);
});

/* ── производные показатели ────────────────────────────────────────────── */

export interface SalesSummary {
  /** Всего продаж за всё время. */
  count: number;
  revenue: number;
  paid: number;
  /** Выручка минус оплаченное. НЕ то же, что сумма поля `debt` у клиентов. */
  unpaid: number;
  siteRevenue: number;
  storeRevenue: number;
  siteCount: number;
  firstDate: string | null;
  lastDate: string | null;
}

export function summarize(all: Sale[]): SalesSummary {
  /* Возвраты в X2pos лежат в том же списке, что и продажи. Считать их
     выручкой нельзя — иначе отменённая отгрузка увеличивает оборот. */
  const sales = all.filter((s) => !s.isReturn);
  const dates = sales.map((s) => s.date).filter(Boolean).sort();
  const revenue = sales.reduce((a, s) => a + s.total, 0);
  const paid = sales.reduce((a, s) => a + s.paid, 0);
  return {
    count: sales.length,
    revenue,
    paid,
    unpaid: revenue - paid,
    siteRevenue: sales.filter((s) => s.fromSite).reduce((a, s) => a + s.total, 0),
    storeRevenue: sales.filter((s) => !s.fromSite).reduce((a, s) => a + s.total, 0),
    siteCount: sales.filter((s) => s.fromSite).length,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
  };
}

/** Продажи по неделям за последние `weeks` недель, разделённые на сайт и магазин. */
export function weekly(sales: Sale[], weeks = 12): { label: string; site: number; store: number }[] {
  const now = new Date();
  const buckets: { label: string; site: number; store: number; from: Date; to: Date }[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const to = new Date(now);
    to.setDate(to.getDate() - i * 7);
    const from = new Date(to);
    from.setDate(from.getDate() - 7);
    buckets.push({ label: shortDate(to), site: 0, store: 0, from, to });
  }

  for (const s of sales) {
    if (!s.date) continue;
    const d = new Date(s.date.replace(" ", "T"));
    if (Number.isNaN(d.getTime())) continue;
    const b = buckets.find((x) => d > x.from && d <= x.to);
    if (!b) continue;
    if (s.fromSite) b.site += s.total;
    else b.store += s.total;
  }

  return buckets.map(({ label, site, store }) => ({ label, site, store }));
}

/** Топ товаров по выручке за всё время. */
export function topProducts(sales: Sale[], limit = 10) {
  const byName = new Map<string, { revenue: number; qty: number }>();
  for (const s of sales) {
    for (const it of s.items) {
      const cur = byName.get(it.name) ?? { revenue: 0, qty: 0 };
      cur.revenue += it.total;
      cur.qty += it.qty;
      byName.set(it.name, cur);
    }
  }
  return [...byName.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
function shortDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export { toKzt, toQty };
