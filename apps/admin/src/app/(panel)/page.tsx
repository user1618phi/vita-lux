import { redirect } from "next/navigation";
import Link from "next/link";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db, schema } from "@vita/db/client";
import { formatTenge, groupDigits } from "@vita/core/format";
import { currentAdmin } from "@/lib/auth";
import {
  getAccounts,
  getCustomers,
  getSales,
  summarize,
  topProducts,
  weeklyCombined,
  type SiteOrder,
} from "@/lib/x2pos-read";
import { AppShell, Empty, Panel, Section } from "@/components/AppShell";
import { Deferred, DeferredSkeleton, StatRowSkeleton } from "@/components/Deferred";
import { StatRow, StatTile } from "@/components/StatTile";
import { BarList } from "@/components/charts/BarList";
import { TimeSeries } from "@/components/charts/TimeSeries";

export const dynamic = "force-dynamic";

/* Сводка.

   Первый экран отвечает на один вопрос: где сейчас деньги.

   КЛЮЧЕВОЕ РЕШЕНИЕ: страница НЕ ждёт X2pos. Он отвечает из региона Vercel
   дольше, чем отведено функции, и пока Сводка была одним большим `await`,
   весь экран падал в «данные не получены» — включая половину, которая
   считается по своей базе и готова мгновенно.

   Теперь своё — готовность каталога, заказы сайта, блок «требует внимания» —
   отдаётся сразу, а куски со складскими цифрами приходят потоком через
   `Deferred`. Не придут — погаснет только их кусок. Это не про скорость, а
   про изоляцию отказа: внешний сервис не должен решать, покажется ли
   страница вообще. */

export default async function DashboardPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

  const [readiness, site] = await Promise.all([catalogReadiness(), siteOrders()]);

  return (
    <AppShell title="Сводка" subtitle="Каталог и заказы сайта — на сейчас. Данные склада подгружаются.">
      <StatRow>
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
        <Deferred fallback={<StatRowSkeleton count={2} />}>
          <WarehouseTiles />
        </Deferred>
      </StatRow>

      <Section
        title="Продажи по неделям"
        hint="Один склад, два канала. Сайт считается по своим заказам, магазин — по продажам X2pos через кассу."
      >
        <Deferred fallback={<DeferredSkeleton height={260} />}>
          <SalesChart siteRows={site.rows} />
        </Deferred>
      </Section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section
          title="Кому отгрузили в долг"
          hint="Баланс клиента по данным X2pos. С «не оплачено» не сходится — это разные счётчики, объяснение на Складе."
        >
          <Deferred fallback={<DeferredSkeleton height={300} />}>
            <DebtorsPanel />
          </Deferred>
        </Section>

        <Section title="Что продаётся" hint="Топ по выручке за всё время, по данным продаж X2pos.">
          <Deferred fallback={<DeferredSkeleton height={300} />}>
            <TopProductsPanel />
          </Deferred>
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

/* ── куски, которые ждут X2pos ─────────────────────────────────────────── */

async function WarehouseTiles() {
  const [sales, accounts] = await Promise.all([getSales(), getAccounts()]);
  const s = sales.ok ? summarize(sales.data) : null;
  const money = accounts.ok ? accounts.data.reduce((a, x) => a + x.amount, 0) : null;

  return (
    <>
      <StatTile
        label="Не оплачено"
        value={s ? formatTenge(s.unpaid) : "—"}
        unavailable={!s}
        fraction={s && s.revenue > 0 ? s.unpaid / s.revenue : undefined}
        tone="danger"
        caption={
          s
            ? `${Math.round((s.unpaid / Math.max(s.revenue, 1)) * 100)}% выручки · отгружено ${formatTenge(s.revenue)}`
            : undefined
        }
      />
      <StatTile
        label="Деньги на счетах"
        value={money !== null ? formatTenge(money) : "—"}
        unavailable={money === null}
        tone="success"
        caption={accounts.ok ? `${accounts.data.length} счёта в X2pos` : undefined}
      />
    </>
  );
}

async function SalesChart({ siteRows }: { siteRows: SiteOrder[] }) {
  const sales = await getSales();
  if (!sales.ok) {
    return (
      <Panel>
        <Unavailable reason={sales.reason} />
      </Panel>
    );
  }
  return (
    <Panel>
      <TimeSeries data={weeklyCombined(sales.data, siteRows)} />
    </Panel>
  );
}

async function DebtorsPanel() {
  const customers = await getCustomers();
  if (!customers.ok) {
    return (
      <Panel>
        <Unavailable reason={customers.reason} />
      </Panel>
    );
  }
  const total = customers.data.reduce((a, c) => a + c.debt, 0);
  return (
    <Panel>
      <BarList
        tone="danger"
        emptyLabel="Долгов нет"
        data={customers.data
          .filter((c) => c.debt > 0)
          .slice(0, 8)
          .map((c) => ({
            id: c.id,
            label: c.name,
            sub: c.city ?? undefined,
            value: c.debt,
            display: formatTenge(c.debt),
          }))}
      />
      <div
        className="flex items-baseline justify-between px-4 py-2"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <span style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
          Всего по карточкам клиентов
        </span>
        <span className="vl-mono" style={{ color: "var(--text-primary)" }}>
          {formatTenge(total)}
        </span>
      </div>
    </Panel>
  );
}

async function TopProductsPanel() {
  const sales = await getSales();
  if (!sales.ok) {
    return (
      <Panel>
        <Unavailable reason={sales.reason} />
      </Panel>
    );
  }
  return (
    <Panel>
      <BarList
        emptyLabel="Продаж ещё не было"
        data={topProducts(sales.data, 8).map((p) => ({
          id: p.name,
          label: p.name,
          sub: `${groupDigits(p.qty)} шт`,
          value: p.revenue,
          display: formatTenge(p.revenue),
        }))}
      />
    </Panel>
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

function Unavailable({ reason }: { reason: string }) {
  return (
    <Empty
      title="Данные из X2pos не получены"
      hint={`${reason}. Остальная панель работает — цифры вернутся, как только склад ответит.`}
    />
  );
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
