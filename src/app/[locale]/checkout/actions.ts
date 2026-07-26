"use server";

import { getLocale } from "next-intl/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, hasDatabase, schema } from "@/db/client";
import { resolveLines } from "@/lib/repo";
import { getSettings } from "@/lib/settings";
import { encryptPii, hashEphemeral, hashPii } from "@/lib/crypto";
import { normalizeKzPhone } from "@/lib/phone-kz";
import { newRefCode } from "@/lib/order/ref";
import { notifyNewOrder } from "@/lib/order/notify";
import { CONSENT_VERSION } from "@/lib/order/consent";

/* Order placement.

   Replaces a client-side Math.random() order number that was never stored
   anywhere. Prices are never taken from the browser — the cart sends handles
   and quantities, and everything chargeable is re-read on the server. */

const inputSchema = z.object({
  lines: z.array(z.object({ handle: z.string().min(1), qty: z.number().int().min(1).max(99) })).min(1).max(50),
  deliveryMethod: z.enum(["courier", "pickup"]),
  paymentMethod: z.enum(["card", "kaspi", "install", "cash"]),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(1).max(40),
  city: z.string().trim().max(120).optional(),
  address: z.string().trim().max(300).optional(),
  comment: z.string().trim().max(1000).optional(),
  consent: z.boolean(),
  idempotencyKey: z.string().min(8).max(100),
  honeypot: z.string().max(0).optional(), // bots fill hidden fields
});

export type OrderInput = z.infer<typeof inputSchema>;

export type OrderResult =
  | { ok: true; refCode: string }
  | { ok: false; code: "VALIDATION"; field: string; message: string }
  | { ok: false; code: "ITEM_UNAVAILABLE"; handles: string[]; message: string }
  | { ok: false; code: "RATE_LIMIT" | "DB" | "UNKNOWN"; message: string };

/* Per-IP throttle. In-memory is right-sized for a single instance; if this
   ever runs on several, move it to a table. */
const recentOrders = new Map<string, number[]>();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 5;

function rateLimited(ipHash: string): boolean {
  const now = Date.now();
  const hits = (recentOrders.get(ipHash) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recentOrders.set(ipHash, hits);
  if (hits.length >= RATE_MAX) return true;
  hits.push(now);
  return false;
}

export async function placeOrder(raw: unknown): Promise<OrderResult> {
  try {
    return await placeOrderInner(raw);
  } catch {
    // Nothing about the payload is logged — it contains customer data.
    console.error("[order] unexpected failure while placing an order");
    return { ok: false, code: "UNKNOWN", message: "Не удалось оформить заказ — напишите нам в WhatsApp" };
  }
}

async function placeOrderInner(raw: unknown): Promise<OrderResult> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      code: "VALIDATION",
      field: String(issue?.path?.[0] ?? "form"),
      message: "Проверьте заполнение формы",
    };
  }
  const input = parsed.data;

  if (input.honeypot) {
    // Pretend success so a bot does not learn it was caught.
    return { ok: true, refCode: newRefCode() };
  }

  if (!input.consent) {
    return { ok: false, code: "VALIDATION", field: "consent", message: "Нужно согласие на обработку данных" };
  }

  const phone = normalizeKzPhone(input.phone);
  if (!phone.ok) {
    return {
      ok: false,
      code: "VALIDATION",
      field: "phone",
      message:
        phone.reason === "prefix"
          ? "Укажите мобильный номер — на него позвонит менеджер"
          : "Проверьте номер телефона: например, +7 707 996 17 17",
    };
  }

  if (input.deliveryMethod === "courier") {
    if (!input.city) return { ok: false, code: "VALIDATION", field: "city", message: "Укажите город" };
    if (!input.address) return { ok: false, code: "VALIDATION", field: "address", message: "Укажите адрес доставки" };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const ipHash = hashEphemeral(ip);
  if (rateLimited(ipHash)) {
    return { ok: false, code: "RATE_LIMIT", message: "Слишком много заказов подряд. Напишите нам в WhatsApp." };
  }

  const locale = await getLocale();

  /* Re-price on the server. The browser sends handles and quantities only —
     whatever it claims a product costs is ignored. */
  const resolved = await resolveLines(input.lines, locale);
  const byHandle = new Map(resolved.map((r) => [r.item.handle, r.item]));

  const missing = input.lines.filter((l) => !byHandle.has(l.handle)).map((l) => l.handle);
  const unbuyable = resolved.filter((r) => r.item.priceOnRequest || r.item.stock === "out").map((r) => r.item.handle);
  if (missing.length || unbuyable.length) {
    return {
      ok: false,
      code: "ITEM_UNAVAILABLE",
      handles: [...missing, ...unbuyable],
      message: "Часть товаров недоступна — обновите корзину",
    };
  }

  const settings = await getSettings();
  const items = input.lines.map((l) => {
    const item = byHandle.get(l.handle)!;
    return {
      handle: item.handle,
      sku: item.sku,
      name: item.name,
      qty: l.qty,
      unitPriceKzt: item.price,
      lineTotalKzt: item.price * l.qty,
    };
  });

  const subtotal = items.reduce((s, i) => s + i.lineTotalKzt, 0);
  const deliveryKzt =
    input.deliveryMethod === "pickup" || subtotal >= settings.freeFromKzt ? 0 : settings.deliveryCostKzt;
  const total = subtotal + deliveryKzt;

  if (!hasDatabase()) {
    // No database configured: say so rather than inventing an order number the
    // way the old client-side code did. The UI falls back to WhatsApp.
    return { ok: false, code: "DB", message: "Оформление временно недоступно — напишите нам в WhatsApp" };
  }

  let refCode = "";
  try {
    const existing = await db()
      .select({ refCode: schema.order.refCode })
      .from(schema.order)
      .where(eq(schema.order.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existing.length) {
      return { ok: true, refCode: existing[0].refCode };
    }

    // Retry on the (very unlikely) ref-code collision the unique index catches.
    for (let attempt = 0; attempt < 3 && !refCode; attempt++) {
      const candidate = newRefCode();
      try {
        await db().transaction(async (tx) => {
          const [row] = await tx
            .insert(schema.order)
            .values({
              refCode: candidate,
              locale,
              subtotalKzt: subtotal,
              deliveryKzt,
              totalKzt: total,
              deliveryMethod: input.deliveryMethod,
              paymentMethod: input.paymentMethod,
              city: input.city ?? null,
              comment: input.comment ?? null,
              nameEnc: encryptPii(input.name),
              phoneEnc: encryptPii(phone.e164),
              phoneHash: hashPii(phone.e164),
              addressEnc: input.address ? encryptPii(input.address) : null,
              consentVersion: CONSENT_VERSION,
              consentAt: new Date(),
              idempotencyKey: input.idempotencyKey,
            })
            .returning({ id: schema.order.id });

          await tx.insert(schema.orderItem).values(
            items.map((i) => ({
              orderId: row.id,
              sku: i.sku,
              productHandle: i.handle,
              nameSnapshot: i.name, // snapshot: prices and names change, orders must not
              unitPriceKzt: i.unitPriceKzt,
              qty: i.qty,
              lineTotalKzt: i.lineTotalKzt,
            })),
          );
        });
        refCode = candidate;
      } catch (err) {
        const message = (err as Error).message ?? "";
        // Someone else won the race on the idempotency key.
        if (message.includes("idempotency")) {
          const [row] = await db()
            .select({ refCode: schema.order.refCode })
            .from(schema.order)
            .where(eq(schema.order.idempotencyKey, input.idempotencyKey))
            .limit(1);
          if (row) return { ok: true, refCode: row.refCode };
        }
        if (!message.includes("ref_code")) throw err; // not a collision — real failure
      }
    }

    if (!refCode) throw new Error("could not allocate a unique ref code");
  } catch {
    // Deliberately no payload in the log: never write customer data to logs.
    console.error("[order] failed to persist an order");
    return { ok: false, code: "DB", message: "Не удалось сохранить заказ — напишите нам в WhatsApp" };
  }

  /* Notification is awaited but non-fatal — the order already exists. */
  const delivered = await notifyNewOrder({
    refCode,
    totalKzt: total,
    deliveryKzt,
    city: input.city ?? null,
    address: input.address ?? null,
    comment: input.comment ?? null,
    name: input.name,
    phoneE164: phone.e164,
    deliveryMethod: input.deliveryMethod,
    paymentMethod: input.paymentMethod,
    items,
  });

  try {
    await db()
      .update(schema.order)
      .set({ notifyStatus: delivered ? "sent" : "failed" })
      .where(eq(schema.order.refCode, refCode));
  } catch {
    // status only — not worth failing the order
  }

  return { ok: true, refCode };
}
