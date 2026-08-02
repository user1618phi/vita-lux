import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";
import { formatTenge, groupDigits } from "@vita/core/format";
import {
  DELIVERY_LABEL,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABEL,
  PAYMENT_LABEL,
  type OrderStatus,
} from "@vita/core/order/labels";
import { AppShell, Empty } from "@/components/AppShell";
import { DataTable, Muted, type Column } from "@/components/DataTable";
import { StatRow, StatTile } from "@/components/StatTile";
import { OrderStatusChip, inputStyle } from "@/app/ui";
import { listOrders, type OrderRow } from "./actions";
import { ORDERS_PER_PAGE } from "./pagination";

export const dynamic = "force-dynamic";

/* Заказы сайта.

   Персональных данных здесь нет ни одного поля — ни имени, ни телефона, ни
   адреса. Всё, что нужно, чтобы решить «каким заказом заняться», видно и без
   них: сумма, способ доставки, город, дата и статус. ПД показывает только
   карточка, и только она пишет запись в журнал доступа.

   Колонка «В X2pos» — сверка. Заказ сайта обязан стать продажей на складе,
   иначе остаток не спишется и товар уедет дважды. Пустая ячейка значит, что
   он ещё в очереди или застрял; разбираться с этим — на экране «Обмен».

   Продаж магазина здесь нет намеренно. Это экран заказов САЙТА, и мешать в
   него кассовые продажи значит смешивать две разные работы: здесь звонят
   покупателю и меняют статус, а к продажам магазина отсюда прикоснуться
   нельзя вовсе. Они на Складе и в Сводке, где идут в сравнении.

   Заодно экран перестал ходить в X2pos на каждый рендер: всё, что он
   показывает, лежит в своей базе.

   Умолчание — «Новые»: это очередь работы, а не архив. */

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

  const sp = await searchParams;
  const status = (sp.status ?? "new") as OrderStatus | "all";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const query = sp.q?.trim() || undefined;

  const { rows, total } = await listOrders({ status, query, page });

  const pages = Math.max(1, Math.ceil(total / ORDERS_PER_PAGE));
  const sum = rows.reduce((a, o) => a + o.totalKzt, 0);

  const columns: Column<OrderRow>[] = [
    {
      key: "ref",
      header: "Номер",
      width: 130,
      render: (o) => (
        <Link
          href={`/orders/${o.id}`}
          className="vl-mono"
          style={{ color: "var(--text-primary)", textDecoration: "none" }}
        >
          {o.refCode}
        </Link>
      ),
    },
    { key: "date", header: "Дата", width: 120, render: (o) => <Muted>{fmtDate(o.createdAt)}</Muted> },
    { key: "status", header: "Статус", width: 130, render: (o) => <OrderStatusChip status={o.status} /> },
    { key: "items", header: "Позиций", numeric: true, width: 90, render: (o) => groupDigits(o.items) },
    { key: "total", header: "Сумма", numeric: true, render: (o) => `${groupDigits(o.totalKzt)} ₸` },
    {
      key: "delivery",
      header: "Доставка",
      secondary: true,
      render: (o) => (
        <Muted>
          {DELIVERY_LABEL[o.deliveryMethod]}
          {o.city ? ` · ${o.city}` : ""}
        </Muted>
      ),
    },
    {
      key: "payment",
      header: "Оплата",
      secondary: true,
      width: 120,
      render: (o) => <Muted>{PAYMENT_LABEL[o.paymentMethod]}</Muted>,
    },
    {
      key: "x2pos",
      header: "В X2pos",
      width: 130,
      render: (o) =>
        o.x2posOrderId ? (
          <span className="vl-mono" style={{ color: "var(--state-success)", fontSize: "var(--text-caption)" }}>
            {o.x2posOrderId}
          </span>
        ) : o.status === "cancelled" ? (
          <Muted>отменён</Muted>
        ) : (
          <Link href="/sync" style={{ color: "var(--brass-text)", textDecoration: "none" }}>
            не доехал
          </Link>
        ),
    },
    {
      key: "notify",
      header: "",
      width: 40,
      render: (o) =>
        o.notifyStatus === "failed" ? (
          <span title="Уведомление в Telegram не дошло" style={{ color: "var(--state-danger)" }}>
            !
          </span>
        ) : null,
    },
  ];

  const tabs: { key: OrderStatus | "all"; label: string }[] = [
    ...ORDER_STATUS_FLOW.map((f) => ({ key: f, label: ORDER_STATUS_LABEL[f] })),
    { key: "all", label: "Все" },
  ];

  return (
    <AppShell
      title="Заказы"
      subtitle="Заказы с сайта. Продажи магазина идут мимо — они видны на Складе и в Сводке."
    >
      <StatRow>
        <StatTile label="Заказов найдено" value={groupDigits(total)} tone="site" caption={`статус: ${status === "all" ? "любой" : ORDER_STATUS_LABEL[status]}`} />
        {/* Сумма по СВОИМ заказам, как и на Сводке. Считать здесь по X2pos
            значило бы показать ноль рядом с непустым списком заказов — заказ
            доезжает туда через очередь и не мгновенно. */}
        <StatTile
          label="Сумма заказов"
          value={formatTenge(sum)}
          tone="site"
          caption="на текущей странице списка"
        />
        <StatTile
          label="Средний чек"
          value={rows.length > 0 ? formatTenge(Math.round(sum / rows.length)) : "—"}
          tone="site"
          caption="на текущей странице списка"
        />
        <StatTile
          label="Не доехало в X2pos"
          value={groupDigits(rows.filter((o) => !o.x2posOrderId && o.status !== "cancelled").length)}
          tone="danger"
          caption="на текущей странице списка"
        />
      </StatRow>

      <div className="mt-6 mb-4 flex flex-wrap items-center gap-2">
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={query ?? ""}
            placeholder="Номер заказа или телефон"
            style={{ ...inputStyle, height: 40, width: 260 }}
            aria-label="Поиск заказа"
          />
        </form>
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => {
            const on = status === t.key;
            return (
              <Link
                key={t.key}
                href={`/orders?status=${t.key}`}
                className="rounded-md px-3 leading-[32px]"
                style={{
                  fontSize: "var(--text-caption)",
                  textDecoration: "none",
                  background: on ? "var(--action-primary-bg)" : "transparent",
                  color: on ? "var(--action-primary-text)" : "var(--text-secondary)",
                  border: `1px solid ${on ? "transparent" : "var(--border-control)"}`,
                }}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(o) => o.id}
        empty={
          <Empty
            title={query ? "Ничего не нашлось" : "Заказов с таким статусом нет"}
            hint={
              query
                ? "Проверьте номер заказа или телефон."
                : "Сайт ещё молодой — первые заказы появятся здесь сразу после оформления."
            }
          />
        }
        footer={
          pages > 1 ? (
            <div className="flex flex-wrap items-center gap-1">
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={`/orders?status=${status}&page=${n}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                  className="vl-mono rounded-sm px-2 py-1"
                  style={{
                    fontSize: "var(--text-caption)",
                    textDecoration: "none",
                    background: n === page ? "var(--action-primary-bg)" : "transparent",
                    color: n === page ? "var(--action-primary-text)" : "var(--text-secondary)",
                  }}
                >
                  {n}
                </Link>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
              Всего: {groupDigits(total)}
            </span>
          )
        }
      />

    </AppShell>
  );
}
