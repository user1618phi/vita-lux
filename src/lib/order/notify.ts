import "server-only";
import { formatKzPhone } from "@/lib/phone-kz";
import { groupDigits } from "@/lib/format";

/* Order notification.

   Telegram rather than email or SMS: free, instant, already on the phone of
   everyone who needs it, and it needs no domain, no DKIM and no provider
   contract. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (a group works, and is
   the easiest way to reach several people at once).

   The admin has no orders screen in this version, so the message carries the
   full order — including the customer's name and phone, which is the whole
   point of the notification. Revisit that once /admin/orders exists: the
   message can then shrink to a link. */

export interface NotifyPayload {
  refCode: string;
  totalKzt: number;
  deliveryKzt: number;
  city: string | null;
  address: string | null;
  comment: string | null;
  name: string;
  phoneE164: string;
  deliveryMethod: "courier" | "pickup";
  paymentMethod: "card" | "kaspi" | "install" | "cash";
  items: { name: string; sku: string; qty: number; unitPriceKzt: number }[];
}

const DELIVERY_LABEL = { courier: "Курьером", pickup: "Самовывоз" } as const;
const PAYMENT_LABEL = {
  card: "Картой онлайн",
  kaspi: "Kaspi / Halyk",
  install: "Рассрочка",
  cash: "При получении",
} as const;

function buildMessage(o: NotifyPayload): string {
  const lines = [
    `🧾 Новый заказ ${o.refCode}`,
    "",
    ...o.items.map((i) => `• ${i.name} (${i.sku}) — ${i.qty} × ${groupDigits(i.unitPriceKzt)} ₸`),
    "",
    `Товары: ${groupDigits(o.totalKzt - o.deliveryKzt)} ₸`,
    `Доставка: ${o.deliveryKzt === 0 ? "бесплатно" : `${groupDigits(o.deliveryKzt)} ₸`}`,
    `Итого: ${groupDigits(o.totalKzt)} ₸`,
    "",
    `Клиент: ${o.name}`,
    `Телефон: ${formatKzPhone(o.phoneE164)}`,
    `Способ: ${DELIVERY_LABEL[o.deliveryMethod]} · ${PAYMENT_LABEL[o.paymentMethod]}`,
  ];

  if (o.city) lines.push(`Город: ${o.city}`);
  if (o.address) lines.push(`Адрес: ${o.address}`);
  if (o.comment) lines.push(`Комментарий: ${o.comment}`);

  return lines.join("\n");
}

/**
 * Send the notification. Never throws: a hung messenger must not fail an order
 * that is already committed. Returns whether it got through so the caller can
 * record `notify_status` and offer a retry later.
 */
export async function notifyNewOrder(payload: NotifyPayload): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    // Not configured yet — the order is still safely stored.
    console.warn(`[order] ${payload.refCode} placed, but Telegram is not configured`);
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildMessage(payload),
        disable_web_page_preview: true,
      }),
      // A slow messenger must not hold the customer on a spinner.
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
