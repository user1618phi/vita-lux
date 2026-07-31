/* Русские подписи к состояниям заказа.

   Живут в домене, а не в админке: те же значения нужны Telegram-уведомлению на
   витрине, и две копии рано или поздно разошлись бы — в сообщении «Курьером», в
   админке «Доставка курьером», и человек считает это разными вещами.

   Локализация здесь не нужна и не предполагается: заказы читают только
   администраторы, а админка русскоязычная (см. CLAUDE.md). Покупателю статус
   заказа показывает витрина своими i18n-ключами. */

export type OrderStatus = "new" | "confirmed" | "shipped" | "done" | "cancelled";
export type DeliveryMethod = "courier" | "pickup";
export type PaymentMethod = "card" | "kaspi" | "install" | "cash";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  shipped: "Отправлен",
  done: "Выполнен",
  cancelled: "Отменён",
};

/** Порядок как в жизни заказа — им же выстроен фильтр в списке. */
export const ORDER_STATUS_FLOW: OrderStatus[] = ["new", "confirmed", "shipped", "done", "cancelled"];

export const DELIVERY_LABEL: Record<DeliveryMethod, string> = {
  courier: "Курьером",
  pickup: "Самовывоз",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  card: "Картой онлайн",
  kaspi: "Kaspi / Halyk",
  install: "Рассрочка",
  cash: "При получении",
};

/** Отправлено ли уведомление о заказе. `failed` — заказ, о котором никто не
    узнал: самое важное, что список заказов может показать. */
export const NOTIFY_LABEL: Record<"pending" | "sent" | "failed", string> = {
  pending: "не отправлено",
  sent: "отправлено",
  failed: "НЕ ДОСТАВЛЕНО",
};
