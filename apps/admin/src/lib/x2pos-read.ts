import "server-only";
import { desc, sql } from "drizzle-orm";
import { db, schema } from "@vita/db/client";

/* Данные склада для админки — из СВОЕЙ базы, не из X2pos.

   Раньше каждый экран ходил в X2pos напрямую. Из региона Vercel он отвечает
   дольше, чем serverless-функции отведено времени, и панель регулярно писала
   «данные не получены» при живом складе. Оптимизировать там было нечего:
   проблема не в скорости запросов, а в самой зависимости отрисовки страницы
   от внешнего сервиса.

   Теперь справочники зеркалит воркер на Railway (`@vita/x2pos/sync/mirror`) —
   он рядом с X2pos, не ограничен временем и ходит по расписанию. Здесь
   остались обычные SELECT'ы: миллисекунды, никаких таймаутов и никакого кэша —
   Postgres и есть кэш.

   Плата — возраст данных до десяти минут. Он не прячется: `mirrorAge()`
   возвращает его словами, и панель показывает это рядом с цифрами. Дашборд,
   который выдаёт десятиминутную цифру за «сейчас», хуже дашборда, который
   честно говорит, когда обновлялся.

   Агрегации считает Postgres, а не Node: тянуть сотни строк, чтобы сложить их
   в JavaScript, незачем — и перестанет работать, когда продаж станут тысячи. */

export interface Sale {
  id: string;
  date: Date | null;
  total: number;
  paid: number;
  status: string | null;
  customerName: string | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  debt: number;
}

export interface Account {
  id: string;
  name: string;
  type: string | null;
  amount: number;
  currency: string;
}

export interface Doc {
  id: string;
  action: string;
  status: string;
  date: string | null;
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

/* ── сводные показатели ────────────────────────────────────────────────── */

export interface SalesSummary {
  count: number;
  revenue: number;
  paid: number;
  /** Выручка минус оплаченное. НЕ то же, что сумма долгов по карточкам клиентов. */
  unpaid: number;
  storeRevenue: number;
  firstDate: Date | null;
  lastDate: Date | null;
}

export async function salesSummary(): Promise<SalesSummary> {
  const [row] = await db()
    .select({
      count: sql<number>`count(*) filter (where not is_return)::int`,
      revenue: sql<number>`coalesce(sum(total_kzt) filter (where not is_return), 0)::int`,
      paid: sql<number>`coalesce(sum(paid_kzt) filter (where not is_return), 0)::int`,
      storeRevenue: sql<number>`coalesce(sum(total_kzt) filter (where not is_return and not from_site), 0)::int`,
      firstDate: sql<string | null>`min(sold_at)`,
      lastDate: sql<string | null>`max(sold_at)`,
    })
    .from(schema.x2posSale);

  const revenue = Number(row?.revenue ?? 0);
  const paid = Number(row?.paid ?? 0);
  return {
    count: Number(row?.count ?? 0),
    revenue,
    paid,
    unpaid: revenue - paid,
    storeRevenue: Number(row?.storeRevenue ?? 0),
    firstDate: row?.firstDate ? new Date(row.firstDate) : null,
    lastDate: row?.lastDate ? new Date(row.lastDate) : null,
  };
}

/** Продажи магазина по неделям. Группировка — в базе. */
export async function storeWeekly(weeks = 12): Promise<{ weekStart: Date; total: number }[]> {
  const rows = await db()
    .select({
      weekStart: sql<string>`date_trunc('week', sold_at)`,
      total: sql<number>`coalesce(sum(total_kzt), 0)::int`,
    })
    .from(schema.x2posSale)
    .where(sql`not is_return and not from_site and sold_at is not null`)
    .groupBy(sql`date_trunc('week', sold_at)`)
    .orderBy(sql`date_trunc('week', sold_at)`)
    .limit(weeks + 4);
  return rows.map((r) => ({ weekStart: new Date(r.weekStart), total: Number(r.total) }));
}

/** Топ товаров по выручке, по позициям продаж. */
export async function topProducts(limit = 10) {
  const rows = await db()
    .select({
      name: schema.x2posSaleItem.name,
      revenue: sql<number>`coalesce(sum(${schema.x2posSaleItem.totalKzt}), 0)::int`,
      qty: sql<number>`coalesce(sum(${schema.x2posSaleItem.qty}), 0)::float8`,
    })
    .from(schema.x2posSaleItem)
    .innerJoin(schema.x2posSale, sql`${schema.x2posSale.id} = ${schema.x2posSaleItem.saleId}`)
    .where(sql`not ${schema.x2posSale.isReturn}`)
    .groupBy(schema.x2posSaleItem.name)
    .orderBy(sql`sum(${schema.x2posSaleItem.totalKzt}) desc`)
    .limit(limit);
  return rows.map((r) => ({ name: r.name, revenue: Number(r.revenue), qty: Number(r.qty) }));
}

export async function listCustomers(): Promise<Customer[]> {
  const rows = await db()
    .select()
    .from(schema.x2posCustomer)
    .orderBy(desc(schema.x2posCustomer.debtKzt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    city: r.city,
    debt: r.debtKzt,
  }));
}

export async function listAccounts(): Promise<Account[]> {
  const rows = await db()
    .select()
    .from(schema.x2posAccount)
    .orderBy(desc(schema.x2posAccount.amountKzt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    amount: r.amountKzt,
    currency: r.currency,
  }));
}

export async function listDocs(): Promise<Doc[]> {
  const rows = await db().select().from(schema.x2posDoc).orderBy(desc(schema.x2posDoc.docDate));
  return rows.map((r) => ({
    id: r.id,
    action: ACTION_LABEL[r.action] ?? r.action,
    status: r.status,
    date: r.docDate,
    quantity: Number(r.quantity),
    amount: r.amountKzt,
    supplier: r.supplier,
    items: r.items,
  }));
}

export async function listStoreSales(limit = 20): Promise<Sale[]> {
  const rows = await db()
    .select()
    .from(schema.x2posSale)
    .where(sql`not is_return and not from_site`)
    .orderBy(desc(schema.x2posSale.soldAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    date: r.soldAt,
    total: r.totalKzt,
    paid: r.paidKzt,
    status: r.status,
    customerName: r.customerName,
  }));
}

/* ── возраст данных ────────────────────────────────────────────────────── */

/**
 * Насколько свежо зеркало, словами.
 *
 * Показывается рядом с цифрами на каждом экране, где они есть. Это не
 * украшение: между прогонами до десяти минут, и человек, принимающий решение
 * по долгу в 24 миллиона, имеет право знать, на какой момент эта цифра.
 */
export async function mirrorAge(): Promise<{ syncedAt: Date | null; label: string; empty: boolean }> {
  const [row] = await db()
    .select({
      syncedAt: sql<string | null>`max(synced_at)`,
      n: sql<number>`count(*)::int`,
    })
    .from(schema.x2posSale);

  const n = Number(row?.n ?? 0);
  const at = row?.syncedAt ? new Date(row.syncedAt) : null;
  if (!at || n === 0) {
    return { syncedAt: null, label: "обмена со складом ещё не было", empty: true };
  }

  const min = Math.floor((Date.now() - at.getTime()) / 60_000);
  const label =
    min < 1
      ? "данные склада: только что"
      : min < 60
        ? `данные склада: ${min} мин назад`
        : min < 60 * 24
          ? `данные склада: ${Math.floor(min / 60)} ч назад`
          : `данные склада: ${Math.floor(min / 1440)} дн назад`;
  return { syncedAt: at, label, empty: false };
}

/* ── продажи сайта ─────────────────────────────────────────────────────── */

/* Считаются по СВОИМ заказам, а не по зеркалу: заказ доезжает в X2pos через
   очередь, и счёт по зеркалу занижал бы сайт ровно тогда, когда обмен сломан. */
export interface SiteOrder {
  date: Date;
  totalKzt: number;
}

export function weeklyCombined(
  store: { weekStart: Date; total: number }[],
  siteOrders: SiteOrder[],
  weeks = 12,
): { label: string; site: number; store: number }[] {
  const now = new Date();
  const buckets: { label: string; site: number; store: number; from: Date; to: Date }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const to = new Date(now);
    to.setDate(to.getDate() - i * 7);
    const from = new Date(to);
    from.setDate(from.getDate() - 7);
    buckets.push({ label: shortDate(to), site: 0, store: 0, from, to });
  }

  for (const s of store) {
    const b = buckets.find((x) => s.weekStart > x.from && s.weekStart <= x.to);
    if (b) b.store += s.total;
  }
  for (const o of siteOrders) {
    const b = buckets.find((x) => o.date > x.from && o.date <= x.to);
    if (b) b.site += o.totalKzt;
  }
  return buckets.map(({ label, site, store }) => ({ label, site, store }));
}

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
function shortDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
