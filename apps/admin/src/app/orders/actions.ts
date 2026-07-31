"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@vita/db/client";
import { decryptPii, hashPii } from "@vita/core/crypto";
import { normalizeKzPhone } from "@vita/core/phone-kz";
import { normalizeRefCode } from "@vita/core/order/ref";
import type { DeliveryMethod, OrderStatus, PaymentMethod } from "@vita/core/order/labels";
import { audit, currentAdmin } from "@/lib/auth";
import { ORDERS_PER_PAGE } from "./pagination";

/* Заказы.

   Единственное место в системе, где расшифровываются персональные данные
   покупателя. Всё, что здесь написано про аудит и про то, чего в него класть
   нельзя, — не перестраховка, а следствие раздела «Данные и право» в CLAUDE.md:
   ПД собраны в трёх колонках `order` именно затем, чтобы переезд на казахстанский
   хостинг делался одним скриптом. */

const { order, orderItem, attribution } = schema;

async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");
  return admin;
}

export interface OrderRow {
  id: string;
  refCode: string;
  status: OrderStatus;
  totalKzt: number;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  city: string | null;
  notifyStatus: "pending" | "sent" | "failed";
  createdAt: Date;
  items: number;
}

/**
 * Список заказов. Персональных данных здесь НЕТ вообще — ни имени, ни телефона,
 * ни адреса. Город не является персональными данными сам по себе и помогает
 * оценить доставку, поэтому он есть.
 *
 * Отсюда следует, что открытие списка не требует записи в аудит: смотреть не на
 * что.
 */
export async function listOrders(opts: {
  status?: OrderStatus | "all";
  query?: string;
  page?: number;
}): Promise<{ rows: OrderRow[]; total: number }> {
  await requireAdmin();

  const conditions = [];
  if (opts.status && opts.status !== "all") conditions.push(eq(order.status, opts.status));

  /* Поиск по телефону — БЕЗ расшифровки. `phoneHash` детерминирован (HMAC от
     нормализованного номера), под ним индекс `order_phone_idx`, и он для этого
     и заведён. Расшифровывать все заказы, чтобы найти один, значило бы читать
     ПД там, где задача этого не требует. */
  const q = opts.query?.trim();
  if (q) {
    const phone = normalizeKzPhone(q);
    if (phone.ok) {
      conditions.push(eq(order.phoneHash, hashPii(phone.e164)));
    } else {
      /* `normalizeRefCode` возвращает null на строке, которая номером заказа
         быть не может. Подставлять null в eq нельзя: условие выпадет, и поиск
         по мусору вернул бы ВЕСЬ список — то есть «ничего не найдено»
         выглядело бы как «вот все заказы». */
      const ref = normalizeRefCode(q);
      if (!ref) return { rows: [], total: 0 };
      conditions.push(eq(order.refCode, ref));
    }
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const page = Math.max(1, opts.page ?? 1);

  const [{ value: total } = { value: 0 }] = await db()
    .select({ value: count() })
    .from(order)
    .where(where);

  const rows = await db()
    .select({
      id: order.id,
      refCode: order.refCode,
      status: order.status,
      totalKzt: order.totalKzt,
      deliveryMethod: order.deliveryMethod,
      paymentMethod: order.paymentMethod,
      city: order.city,
      notifyStatus: order.notifyStatus,
      createdAt: order.createdAt,
      items: count(orderItem.id),
    })
    .from(order)
    .leftJoin(orderItem, eq(orderItem.orderId, order.id))
    .where(where)
    .groupBy(order.id)
    .orderBy(desc(order.createdAt))
    .limit(ORDERS_PER_PAGE)
    .offset((page - 1) * ORDERS_PER_PAGE);

  return { rows: rows as OrderRow[], total };
}

export interface OrderDetail {
  id: string;
  refCode: string;
  status: OrderStatus;
  createdAt: Date;
  confirmedAt: Date | null;
  subtotalKzt: number;
  deliveryKzt: number;
  totalKzt: number;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  city: string | null;
  comment: string | null;
  adminNote: string | null;
  notifyStatus: "pending" | "sent" | "failed";
  consentVersion: string;
  consentAt: Date;
  /** Расшифрованные ПД. `null` означает «не удалось расшифровать». */
  name: string | null;
  phone: string | null;
  address: string | null;
  /** Хотя бы одно поле не расшифровалось — обычно это смена ключа. */
  piiBroken: boolean;
  items: { id: string; nameSnapshot: string; sku: string; qty: number; unitPriceKzt: number; lineTotalKzt: number }[];
  source: { channel: string | null; utmSource: string | null; utmCampaign: string | null } | null;
}

/** Расшифровка, которая не роняет страницу. Неверный или сменённый
    APP_ENCRYPTION_KEY заставит decryptPii бросить — но нечитаемое имя не повод
    прятать от владельца сам заказ и его сумму. */
function safeDecrypt(value: string | null): { value: string | null; broken: boolean } {
  if (value === null) return { value: null, broken: false };
  try {
    return { value: decryptPii(value), broken: false };
  } catch {
    return { value: null, broken: true };
  }
}

export async function getOrder(id: string): Promise<OrderDetail | null> {
  const admin = await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) return null;

  const [row] = await db().select().from(order).where(eq(order.id, id)).limit(1);
  if (!row) return null;

  const items = await db()
    .select({
      id: orderItem.id,
      nameSnapshot: orderItem.nameSnapshot,
      sku: orderItem.sku,
      qty: orderItem.qty,
      unitPriceKzt: orderItem.unitPriceKzt,
      lineTotalKzt: orderItem.lineTotalKzt,
    })
    .from(orderItem)
    .where(eq(orderItem.orderId, id));

  const [attr] = await db()
    .select({
      channel: attribution.channel,
      utmSource: attribution.utmSource,
      utmCampaign: attribution.utmCampaign,
    })
    .from(attribution)
    .where(eq(attribution.orderId, id))
    .limit(1);

  const name = safeDecrypt(row.nameEnc);
  const phone = safeDecrypt(row.phoneEnc);
  const address = safeDecrypt(row.addressEnc);

  /* Аудит доступа к персональным данным.

     ПРАВИЛО, КОТОРОЕ НЕЛЬЗЯ НАРУШАТЬ: расшифрованные значения в журнал не
     попадают никогда. `audit_log.before_json` / `after_json` — это jsonb в той
     же самой базе, и телефон, скопированный туда, превращает дамп БД обратно в
     дамп персональных данных, ломая обещание держать все ПД в трёх колонках
     `order`. Записываем КТО, КОГДА и КАКОЙ заказ открыл — и никогда что именно
     увидел.

     Гранулярность — одна запись на открытие карточки. Более точный вариант
     (маскировать по умолчанию, показывать по кнопке) стоил бы лишнего касания
     при каждом звонке клиенту; для магазина на три человека это плохой размен. */
  await audit(admin.id, "order", id, "pii-view", null, { fields: ["name", "phone", "address"] });

  return {
    id: row.id,
    refCode: row.refCode,
    status: row.status as OrderStatus,
    createdAt: row.createdAt,
    confirmedAt: row.confirmedAt,
    subtotalKzt: row.subtotalKzt,
    deliveryKzt: row.deliveryKzt,
    totalKzt: row.totalKzt,
    deliveryMethod: row.deliveryMethod as DeliveryMethod,
    paymentMethod: row.paymentMethod as PaymentMethod,
    city: row.city,
    comment: row.comment,
    adminNote: row.adminNote,
    notifyStatus: row.notifyStatus as "pending" | "sent" | "failed",
    consentVersion: row.consentVersion,
    consentAt: row.consentAt,
    name: name.value,
    phone: phone.value,
    address: address.value,
    piiBroken: name.broken || phone.broken || address.broken,
    items,
    source: attr ?? null,
  };
}

const statusSchema = z.enum(["new", "confirmed", "shipped", "done", "cancelled"]);

export async function setOrderStatusAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const admin = await requireAdmin();

  const id = String(formData.get("orderId") ?? "");
  if (!z.string().uuid().safeParse(id).success) return { error: "Некорректный заказ" };

  const parsed = statusSchema.safeParse(String(formData.get("status") ?? ""));
  if (!parsed.success) return { error: "Неизвестный статус" };

  const [row] = await db().select({ status: order.status }).from(order).where(eq(order.id, id)).limit(1);
  if (!row) return { error: "Заказ не найден" };

  await db()
    .update(order)
    .set({
      status: parsed.data,
      // Момент подтверждения фиксируем один раз — это точка отсчёта для сроков.
      ...(parsed.data === "confirmed" ? { confirmedAt: new Date() } : {}),
    })
    .where(eq(order.id, id));

  // В журнал идут только статусы. Ничего персонального.
  await audit(admin.id, "order", id, "status", { status: row.status }, { status: parsed.data });

  revalidatePath(`/orders/${id}`);
  revalidatePath("/orders");
  return { ok: true };
}

export async function saveAdminNoteAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const admin = await requireAdmin();

  const id = String(formData.get("orderId") ?? "");
  if (!z.string().uuid().safeParse(id).success) return { error: "Некорректный заказ" };

  const note = String(formData.get("adminNote") ?? "").trim().slice(0, 2000);
  await db().update(order).set({ adminNote: note || null }).where(eq(order.id, id));

  /* Только ДЛИНА заметки, не содержимое. Поле свободное, и рано или поздно в
     него впишут телефон — тогда журнал начнёт хранить ПД, чего он не должен. */
  await audit(admin.id, "order", id, "note", null, { length: note.length });

  revalidatePath(`/orders/${id}`);
  return { ok: true };
}
