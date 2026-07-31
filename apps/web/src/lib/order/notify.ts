import "server-only";
import { formatKzPhone } from "@vita/core/phone-kz";
import { groupDigits } from "@vita/core/format";

/* Order notification.

   Telegram rather than email or SMS: free, instant, already on the phone of
   everyone who needs it, and it needs no domain, no DKIM and no provider
   contract. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (a group works, and is
   the easiest way to reach several people at once).

   Пересмотрено, как и обещал прежний комментарий. Раньше сообщение несло имя,
   телефон, адрес и комментарий покупателя — потому что экрана заказов не
   существовало и увидеть их было больше негде. Теперь он есть (`/orders` в
   apps/admin), и уведомление сокращено до номера, суммы и ссылки.

   Это не косметика: Telegram — чужой сервис вне Казахстана, а закон требует
   хранить персональные данные граждан РК на серверах в РК. Держать их ещё и в
   переписке мессенджера — лишняя копия там, где её никто не контролирует и
   откуда её нельзя удалить. Номера заказа достаточно, чтобы открыть карточку.

   НЕ добавляй сюда имя и телефон обратно. */

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
    `Позиций: ${o.items.length}`,
    `Итого: ${groupDigits(o.totalKzt)} ₸`,
    `Способ: ${DELIVERY_LABEL[o.deliveryMethod]} · ${PAYMENT_LABEL[o.paymentMethod]}`,
  ];

  // Город — не персональные данные и помогает прикинуть доставку с телефона.
  if (o.city) lines.push(`Город: ${o.city}`);

  /* Имя, телефон, адрес и комментарий сюда НЕ попадают: они есть в карточке
     заказа, доступ к которой ограничен и записывается в журнал. */
  const base = process.env.ADMIN_ORDER_URL;
  lines.push("", base ? `Открыть: ${base}/orders` : "Открыть заказ в админке");

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
