import { redirect } from "next/navigation";
import Link from "next/link";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db, schema } from "@vita/db/client";
import { formatTenge, groupDigits } from "@vita/core/format";
import { currentAdmin } from "@/lib/auth";
import {
  listAccounts,
  listCustomers,
  mirrorAge,
  salesSummary,
  storeWeekly,
  topProducts,
  weeklyCombined,
} from "@/lib/x2pos-read";
import { AppShell, Empty, Panel, Section } from "@/components/AppShell";
import { StatRow, StatTile } from "@/components/StatTile";
import { BarList } from "@/components/charts/BarList";
import { TimeSeries } from "@/components/charts/TimeSeries";

export const dynamic = "force-dynamic";

/* Сводка.

   Первый экран отвечает на один вопрос: где сейчас деньги. Для оптового
   склада, у которого две трети выручки не оплачены, это в первую очередь
   долг, а уже потом обороты.

   Всё до единой цифры читается из СВОЕЙ базы — и то, что про сайт, и то, что
   про склад. В X2pos эта страница не ходит вовсе: справочники туда зеркалит
   воркер на Railway по расписанию. Отсюда и скорость, и то, что экран больше
   не может упасть из-за недоступного склада.

   Возраст складских цифр показан в подзаголовке. Между прогонами до десяти
   минут, и человек, который смотрит на долг в 24 миллиона, имеет право знать,
   на какой момент это число. */

export default async function DashboardPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

  const [readiness, site, sales, customers, accounts, weekly, top, age] = await Promise.all([
    catalogReadiness(),
    siteOrders(),
    salesSummary(),
    listCustomers(),
    listAccounts(),
    storeWeekly(),
    topProducts(8),
    mirrorAge(),
  ]);

  const money = accounts.reduce((a, x) => a + x.amount, 0);
  const customerDebt = customers.reduce((a, c) => a + c.debt, 0);
  const debtors = customers.filter((c) => c.debt > 0);

  return (
    <AppShell
      title="Сводка"
      subtitle={
        age.empty
          ? "Каталог и заказы сайта. Обмена со складом ещё не было — цифры X2pos появятся после первой синхронизации."
          : `Каталог и заказы сайта — на сейчас · ${age.label}`
      }
    >
      <StatRow>
        <StatTile
          label="Не оплачено"
          value={age.empty ? "—" : formatTenge(sales.unpaid)}
          unavailable={age.empty}
          fraction={sales.revenue > 0 ? sales.unpaid / sales.revenue : undefined}
          tone="danger"
          caption={
            sales.revenue > 0
              ? `${Math.round((sales.unpaid / sales.revenue) * 100)}% выручки · отгружено ${formatTenge(sales.revenue)}`
              : undefined
          }
        />
        <StatTile
          label="Деньги на счетах"
          value={accounts.length > 0 ? formatTenge(money) : "—"}
          unavailable={accounts.length === 0}
          tone="success"
          caption={accounts.length > 0 ? `${accounts.length} счёта в X2pos` : undefined}
        />
        <StatTile
          label="Продажи сайта"
          value={formatTenge(site.revenue)}
          tone="site"
          caption={
            site.count > 0
              ? `${site.count} заказов · не доехало в X2pos ${site.notSynced}`
              : "сайт ещё не продавал"
          }
        />
        <StatTile
          label="Готово к продаже"
          value={`${readiness.ready} из ${readiness.total}`}
          fraction={readiness.total > 0 ? readiness.ready / readiness.total : 0}
          tone="brass"
          caption={
            readiness.drafts > 0 ? `${readiness.drafts} черновиков ждут карточки` : "все товары заполнены"
          }
        />
      </StatRow>

      <Section
        title="Продажи по неделям"
        hint="Один склад, два канала. Сайт считается по своим заказам, магазин — по продажам X2pos через кассу."
      >
        <Panel>
          <TimeSeries data={weeklyCombined(weekly, site.rows)} />
        </Panel>
      </Section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section
          title="Кому отгрузили в долг"
          hint="Баланс клиента по данным X2pos. С «не оплачено» не сходится — это разные счётчики, объяснение на Складе."
        >
          <Panel>
            <BarList
              tone="danger"
              emptyLabel={age.empty ? "Данных со склада ещё нет" : "Долгов нет"}
              data={debtors.slice(0, 8).map((c) => ({
                id: c.id,
                label: c.name,
                sub: c.city ?? undefined,
                value: c.debt,
                display: formatTenge(c.debt),
              }))}
            />
            {debtors.length > 0 ? (
              <div
                className="flex items-baseline justify-between px-4 py-2"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <span style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
                  Всего по карточкам клиентов · должников {debtors.length} из {customers.length}
                </span>
                <span className="vl-mono" style={{ color: "var(--text-primary)" }}>
                  {formatTenge(customerDebt)}
                </span>
              </div>
            ) : null}
          </Panel>
        </Section>

        <Section title="Что продаётся" hint="Топ по выручке за всё время, по данным продаж X2pos.">
          <Panel>
            <BarList
              emptyLabel={age.empty ? "Данных со склада ещё нет" : "Продаж ещё не было"}
              data={top.map((p) => ({
                id: p.name,
                label: p.name,
                sub: `${groupDigits(Math.round(p.qty))} шт`,
                value: p.revenue,
                display: formatTenge(p.revenue),
              }))}
            />
          </Panel>
        </Section>
      </div>

      <Section title="Требует внимания" hint="Что мешает сайту продавать прямо сейчас.">
        <Panel>
          {readiness.issues.length === 0 ? (
            <Empty title="Всё в порядке" hint="Каталог заполнен, зависших задач нет." />
          ) : (
            <ul className="m-0 list-none p-0">
              {readiness.issues.map((i) => (
                <li
                  key={i.href + i.label}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <span style={{ fontSize: "var(--text-body-s)", color: "var(--text-primary)" }}>
                    {i.label}
                  </span>
                  <Link
                    href={i.href}
                    className="vl-mono shrink-0 rounded-md px-2 py-1"
                    style={{
                      fontSize: "var(--text-caption)",
                      textDecoration: "none",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-control)",
                    }}
                  >
                    {i.count}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </Section>
    </AppShell>
  );
}

/* Заказы сайта из своей базы. Отменённые не в счёт: денег по ним не будет. */
async function siteOrders() {
  const rows = await db()
    .select({
      date: schema.order.createdAt,
      totalKzt: schema.order.totalKzt,
      x2posOrderId: schema.order.x2posOrderId,
    })
    .from(schema.order)
    .where(ne(schema.order.status, "cancelled"));

  return {
    rows: rows.map((r) => ({ date: r.date, totalKzt: r.totalKzt })),
    revenue: rows.reduce((a, r) => a + r.totalKzt, 0),
    count: rows.length,
    notSynced: rows.filter((r) => !r.x2posOrderId).length,
  };
}

/* ── готовность каталога ───────────────────────────────────────────────── */

/* Считается по своей базе, поэтому работает даже когда X2pos лежит.

   «Готов к продаже» — то же условие, по которому витрина решает, можно ли
   положить товар в корзину: опубликован и цена есть. Товар без цены
   рендерится как «Цена по запросу» и в корзину не кладётся. */
async function catalogReadiness() {
  const d = db();
  const priceIsCurrent = and(sql`${schema.price.validFrom} <= now()`, isNull(schema.price.validTo));

  const rows = await d
    .select({
      status: schema.product.status,
      retail: schema.price.retailKzt,
      qty: schema.inventory.qty,
      photos: sql<number>`(select count(*)::int from ${schema.media} m where m.product_id = ${schema.product.id})`,
    })
    .from(schema.product)
    .leftJoin(
      schema.variant,
      and(eq(schema.variant.productId, schema.product.id), eq(schema.variant.isDefault, true)),
    )
    .leftJoin(schema.price, and(eq(schema.price.variantId, schema.variant.id), priceIsCurrent))
    .leftJoin(schema.inventory, eq(schema.inventory.variantId, schema.variant.id));

  const stuck = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.x2posOutbox)
    .where(isNull(schema.x2posOutbox.doneAt));

  const total = rows.length;
  const ready = rows.filter((r) => r.status === "active" && r.retail !== null).length;
  const drafts = rows.filter((r) => r.status === "draft").length;
  const noPhoto = rows.filter((r) => Number(r.photos) === 0).length;
  const noPriceInStock = rows.filter((r) => r.retail === null && (r.qty ?? 0) > 0).length;
  const stuckN = Number(stuck[0]?.n ?? 0);

  const issues: { label: string; count: string; href: string }[] = [];
  if (drafts > 0)
    issues.push({
      label: "Черновиков без карточки — не видны на сайте",
      count: String(drafts),
      href: "/products?status=draft",
    });
  if (noPriceInStock > 0)
    issues.push({
      label: "Есть на складе, но без цены — продать нельзя",
      count: String(noPriceInStock),
      href: "/products?issue=noprice",
    });
  if (noPhoto > 0)
    issues.push({ label: "Без фотографии", count: String(noPhoto), href: "/products?issue=nophoto" });
  if (stuckN > 0)
    issues.push({ label: "Заказов не доехало в X2pos", count: String(stuckN), href: "/sync" });

  return { total, ready, drafts, issues };
}
