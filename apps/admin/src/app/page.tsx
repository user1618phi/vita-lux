import { redirect } from "next/navigation";
import Link from "next/link";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@vita/db/client";
import { formatTenge, groupDigits } from "@vita/core/format";
import { currentAdmin } from "@/lib/auth";
import { getAccounts, getCustomers, getSales, summarize, topProducts, weekly } from "@/lib/x2pos-read";
import { AppShell, Empty, Panel, Section } from "@/components/AppShell";
import { StatRow, StatTile } from "@/components/StatTile";
import { BarList } from "@/components/charts/BarList";
import { TimeSeries } from "@/components/charts/TimeSeries";

export const dynamic = "force-dynamic";

/* Сводка.

   Первый экран отвечает на один вопрос: где сейчас деньги. Для оптового
   склада, у которого две трети выручки не оплачены, это в первую очередь
   долг, а уже потом обороты.

   Всё, что приходит из X2pos, приходит через `Result` и переживает его
   недоступность: разделы показывают «данные не получены», а показатель по
   своей базе — готовность каталога — продолжает считаться. */

export default async function DashboardPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

  const [sales, customers, accounts, readiness] = await Promise.all([
    getSales(),
    getCustomers(),
    getAccounts(),
    catalogReadiness(),
  ]);

  const s = sales.ok ? summarize(sales.data) : null;
  const money = accounts.ok ? accounts.data.reduce((a, x) => a + x.amount, 0) : null;
  const customerDebt = customers.ok ? customers.data.reduce((a, c) => a + c.debt, 0) : null;

  return (
    <AppShell
      title="Сводка"
      subtitle={
        s?.firstDate
          ? `Продажи X2pos с ${s.firstDate.slice(0, 10)} по ${s.lastDate?.slice(0, 10)} · каталог сайта на сейчас`
          : "Каталог сайта на сейчас"
      }
    >
      <StatRow>
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
        <StatTile
          label="Продажи сайта"
          value={s ? formatTenge(s.siteRevenue) : "—"}
          unavailable={!s}
          fraction={s && s.revenue > 0 ? s.siteRevenue / s.revenue : undefined}
          tone="site"
          caption={
            s
              ? s.siteCount > 0
                ? `${s.siteCount} из ${s.count} продаж`
                : "сайт ещё не продавал — весь оборот через магазин"
              : undefined
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
        hint="Сайт и магазин продают один и тот же склад. Разделено по метке источника продажи в X2pos."
      >
        <Panel>
          {sales.ok ? (
            <TimeSeries data={weekly(sales.data)} />
          ) : (
            <Unavailable reason={sales.reason} />
          )}
        </Panel>
      </Section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section
          title="Кому отгрузили в долг"
          hint="Баланс клиента по данным X2pos. С «не оплачено» выше не сходится — это разные счётчики, объяснение на Складе."
        >
          <Panel>
            {customers.ok ? (
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
            ) : (
              <Unavailable reason={customers.reason} />
            )}
            {customers.ok && customerDebt !== null ? (
              <div
                className="flex items-baseline justify-between px-4 py-2"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <span style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
                  Всего по карточкам клиентов
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
            {sales.ok ? (
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
            ) : (
              <Unavailable reason={sales.reason} />
            )}
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
