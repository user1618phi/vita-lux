import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";
import { groupDigits } from "@vita/core/format";
import {
  DELIVERY_LABEL,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABEL,
  PAYMENT_LABEL,
  type OrderStatus,
} from "@vita/core/order/labels";
import { logoutAction } from "../actions";
import { AdminNav, OrderStatusChip, PageShell, inputStyle } from "../ui";
import { listOrders } from "./actions";
import { ORDERS_PER_PAGE } from "./pagination";

export const dynamic = "force-dynamic";

/* Список заказов.

   Персональных данных здесь нет ни одного поля — ни имени, ни телефона, ни
   адреса. Всё, что нужно, чтобы решить «каким заказом заняться», видно и без
   них: сумма, способ доставки, город, дата и статус. ПД показывает только
   карточка, и только она пишет запись в журнал доступа.

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
  const status = (ORDER_STATUS_FLOW as string[]).includes(sp.status ?? "")
    ? (sp.status as OrderStatus)
    : sp.status === "all"
      ? "all"
      : "new";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const { rows, total } = await listOrders({ status, query: sp.q, page });
  const pages = Math.max(1, Math.ceil(total / ORDERS_PER_PAGE));

  const tab = (key: string, label: string) => {
    const active = status === key;
    const qs = new URLSearchParams();
    qs.set("status", key);
    if (sp.q) qs.set("q", sp.q);
    return (
      <Link
        key={key}
        href={`/orders?${qs}`}
        className="flex-none rounded-md px-3 font-sans leading-[40px]"
        style={{
          fontSize: "var(--text-body-s)",
          background: active ? "var(--action-primary-bg)" : "transparent",
          color: active ? "var(--action-primary-text)" : "var(--text-secondary)",
          border: active ? "none" : "1px solid var(--border-control)",
          textDecoration: "none",
        }}
      >
        {label}
      </Link>
    );
  };

  return (
    <PageShell
      title="Заказы"
      width="wide"
      nav={<AdminNav current="orders" role={admin.role} username={admin.username} logoutAction={logoutAction} />}
    >
      <form className="flex flex-wrap gap-2">
        <input type="hidden" name="status" value={status} />
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Номер заказа или телефон"
          style={{ ...inputStyle, flex: "1 1 200px", width: "auto" }}
        />
      </form>

      <div className="mt-3 flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {ORDER_STATUS_FLOW.map((s) => tab(s, ORDER_STATUS_LABEL[s]))}
        {tab("all", "Все")}
      </div>

      {rows.length === 0 ? (
        <p
          className="mt-8 text-center font-sans"
          style={{ fontSize: "var(--text-body-s)", color: "var(--text-secondary)" }}
        >
          {sp.q ? "Ничего не найдено" : "Заказов пока нет"}
        </p>
      ) : (
        <ul className="mt-4 m-0 p-0 list-none flex flex-col gap-2">
          {rows.map((o) => (
            <li key={o.id}>
              <Link
                href={`/orders/${o.id}`}
                className="block rounded-lg p-3"
                style={{
                  background: "var(--surface-card)",
                  border: "0.5px solid var(--border)",
                  textDecoration: "none",
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="vl-mono" style={{ fontSize: "var(--text-body)", color: "var(--text-primary)" }}>
                    {o.refCode}
                  </span>
                  <OrderStatusChip status={o.status} />
                </div>

                <div
                  className="mt-1 font-sans"
                  style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}
                >
                  {fmtDate(o.createdAt)} · {o.items} поз. · {DELIVERY_LABEL[o.deliveryMethod]} ·{" "}
                  {PAYMENT_LABEL[o.paymentMethod]}
                  {o.city ? ` · ${o.city}` : ""}
                </div>

                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="vl-mono" style={{ fontSize: "var(--text-body)", color: "var(--text-primary)" }}>
                    {groupDigits(o.totalKzt)} ₸
                  </span>
                  {/* Заказ, о котором никому не сообщили. Самое ценное, что этот
                      экран может показать: деньги ждут, а никто не знает. */}
                  {o.notifyStatus === "failed" ? (
                    <span
                      className="rounded-sm px-2 py-0.5 font-sans"
                      style={{
                        fontSize: "var(--text-micro)",
                        background: "var(--tint-danger)",
                        color: "var(--state-danger)",
                      }}
                    >
                      уведомление не дошло
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav className="mt-5 flex items-center justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => {
            const qs = new URLSearchParams();
            qs.set("status", status);
            if (sp.q) qs.set("q", sp.q);
            qs.set("page", String(p));
            return (
              <Link
                key={p}
                href={`/orders?${qs}`}
                className="grid place-items-center rounded-md font-sans"
                style={{
                  minWidth: 44,
                  height: 44,
                  fontSize: "var(--text-body-s)",
                  background: p === page ? "var(--action-primary-bg)" : "transparent",
                  color: p === page ? "var(--action-primary-text)" : "var(--text-secondary)",
                  border: p === page ? "none" : "1px solid var(--border-control)",
                  textDecoration: "none",
                }}
              >
                {p}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </PageShell>
  );
}
