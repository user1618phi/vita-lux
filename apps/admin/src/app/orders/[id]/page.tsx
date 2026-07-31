import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { notFound, redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";
import { groupDigits } from "@vita/core/format";
import { formatKzPhone } from "@vita/core/phone-kz";
import { DELIVERY_LABEL, NOTIFY_LABEL, PAYMENT_LABEL } from "@vita/core/order/labels";
import { logoutAction } from "../../actions";
import { ErrorBox, OrderStatusChip } from "../../ui";
import { getOrder } from "../actions";
import { OrderForms } from "./OrderForms";

export const dynamic = "force-dynamic";

/* Карточка заказа — единственный экран, показывающий персональные данные.

   Открытие карточки пишет запись в журнал (см. getOrder). Расшифровка каждого
   поля обёрнута так, чтобы сбой ключа не прятал сам заказ: сумма и позиции
   нужны даже тогда, когда имя прочитать не удалось. */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 py-2" style={{ borderBottom: "0.5px solid var(--border)" }}>
      <span className="font-sans" style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
        {label}
      </span>
      <span className="font-sans text-right" style={{ fontSize: "var(--text-body-s)", color: "var(--text-primary)" }}>
        {children}
      </span>
    </div>
  );
}

function fmt(d: Date): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

  const { id } = await params;
  const o = await getOrder(id);
  if (!o) notFound();

  return (
    <PageShell
      title={o.refCode}
      aside={
        <Link
          href="/orders"
          className="font-sans"
          style={{ fontSize: "var(--text-body-s)", color: "var(--text-secondary)", textDecoration: "none" }}
        >
          ← Все заказы
        </Link>
      }
    >
      {o.piiBroken ? (
        <ErrorBox>
          Часть контактных данных не удалось расшифровать. Обычно это значит, что менялся
          APP_ENCRYPTION_KEY — заказ и сумма верны, а имя и телефон придётся уточнить иначе.
        </ErrorBox>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <OrderStatusChip status={o.status} />
        <span className="font-sans" style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
          {fmt(o.createdAt)}
          {o.confirmedAt ? ` · подтверждён ${fmt(o.confirmedAt)}` : ""}
        </span>
      </div>

      <section className="mt-5">
        <h2 className="m-0 mb-1 font-sans font-medium" style={{ fontSize: "var(--text-body)", color: "var(--text-primary)" }}>
          Покупатель
        </h2>
        <Row label="Имя">{o.name ?? "— не удалось расшифровать —"}</Row>
        <Row label="Телефон">
          {o.phone ? (
            <a href={`tel:${o.phone}`} style={{ color: "var(--brass-text)" }}>
              {formatKzPhone(o.phone)}
            </a>
          ) : (
            "— не удалось расшифровать —"
          )}
        </Row>
        {o.address ? <Row label="Адрес">{o.address}</Row> : null}
        {o.city ? <Row label="Город">{o.city}</Row> : null}
        {o.comment ? <Row label="Комментарий">{o.comment}</Row> : null}
      </section>

      <section className="mt-5">
        <h2 className="m-0 mb-1 font-sans font-medium" style={{ fontSize: "var(--text-body)", color: "var(--text-primary)" }}>
          Состав
        </h2>
        <ul className="m-0 p-0 list-none">
          {o.items.map((i) => (
            <li key={i.id} className="py-2" style={{ borderBottom: "0.5px solid var(--border)" }}>
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-sans" style={{ fontSize: "var(--text-body-s)", color: "var(--text-primary)" }}>
                  {i.nameSnapshot}
                </span>
                <span className="vl-mono" style={{ fontSize: "var(--text-body-s)", color: "var(--text-primary)" }}>
                  {groupDigits(i.lineTotalKzt)} ₸
                </span>
              </div>
              <div className="vl-mono" style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}>
                {i.sku} · {i.qty} × {groupDigits(i.unitPriceKzt)} ₸
              </div>
            </li>
          ))}
        </ul>
        <Row label="Товары">{groupDigits(o.subtotalKzt)} ₸</Row>
        <Row label="Доставка">{o.deliveryKzt ? `${groupDigits(o.deliveryKzt)} ₸` : "бесплатно"}</Row>
        <Row label="Итого">
          <strong className="vl-mono">{groupDigits(o.totalKzt)} ₸</strong>
        </Row>
      </section>

      <section className="mt-5">
        <h2 className="m-0 mb-1 font-sans font-medium" style={{ fontSize: "var(--text-body)", color: "var(--text-primary)" }}>
          Оформление
        </h2>
        <Row label="Доставка">{DELIVERY_LABEL[o.deliveryMethod]}</Row>
        <Row label="Оплата">{PAYMENT_LABEL[o.paymentMethod]}</Row>
        <Row label="Уведомление">{NOTIFY_LABEL[o.notifyStatus]}</Row>
        {o.source ? (
          <Row label="Источник">
            {[o.source.channel, o.source.utmSource, o.source.utmCampaign].filter(Boolean).join(" · ") || "—"}
          </Row>
        ) : null}
        {/* Согласие на обработку ПД — доказательство, которого требует закон.
            Показываем версию и момент, чтобы их можно было предъявить. */}
        <Row label="Согласие">
          {o.consentVersion} от {fmt(o.consentAt)}
        </Row>
      </section>

      <OrderForms orderId={o.id} status={o.status} adminNote={o.adminNote} />
    </PageShell>
  );
}
