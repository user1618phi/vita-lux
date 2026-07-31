import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@vita/db/client";
import { isX2posEnabled, readConfig } from "@vita/x2pos/config";
import { buildReturnPayload, type SaleLine } from "@vita/x2pos/sync/outbox";

/* Отмена заказа → возврат товара на склад X2pos.

   Продажа уходит в X2pos со статусом `issued`, то есть остаток списывается в
   момент оформления. Значит отмена обязана его вернуть — иначе склад
   недосчитается товара, которого никто не забирал, и расхождение всплывёт
   только на ревизии.

   Два принципиально разных случая, и путать их нельзя:

     1. Продажа в X2pos уже создана (`order.x2posOrderId` заполнен) — нужен
        документ возврата.
     2. Продажа ещё лежит в очереди и не ушла — возвращать нечего, надо просто
        снять задание. Отправить её сейчас, чтобы тут же вернуть, — это два
        лишних документа в бухгалтерии владельца на пустом месте. */

export interface CancelResult {
  /** Возврат поставлен в очередь. */
  queued: boolean;
  /** Неотправленная продажа снята с очереди. */
  cancelledPending: boolean;
  reason?: string;
}

export async function enqueueReturnForOrder(orderId: string): Promise<CancelResult> {
  if (!isX2posEnabled()) return { queued: false, cancelledPending: false, reason: "X2pos выключен" };

  const d = db();
  const [row] = await d
    .select({ x2posOrderId: schema.order.x2posOrderId, totalKzt: schema.order.subtotalKzt })
    .from(schema.order)
    .where(eq(schema.order.id, orderId))
    .limit(1);
  if (!row) return { queued: false, cancelledPending: false, reason: "заказ не найден" };

  /* Случай 2: продажа не доехала. Снимаем задание и выходим. */
  if (!row.x2posOrderId) {
    const pending = await d
      .update(schema.x2posOutbox)
      .set({ doneAt: new Date(), lastError: "заказ отменён до выгрузки" })
      .where(
        and(
          eq(schema.x2posOutbox.orderId, orderId),
          eq(schema.x2posOutbox.kind, "sale"),
          isNull(schema.x2posOutbox.doneAt),
        ),
      )
      .returning({ id: schema.x2posOutbox.id });
    return { queued: false, cancelledPending: pending.length > 0 };
  }

  /* Уже возвращали — второй документ возврата создаст двойное поступление. */
  const existing = await d
    .select({ id: schema.x2posOutbox.id })
    .from(schema.x2posOutbox)
    .where(and(eq(schema.x2posOutbox.orderId, orderId), eq(schema.x2posOutbox.kind, "return")))
    .limit(1);
  if (existing.length) return { queued: false, cancelledPending: false, reason: "возврат уже создан" };

  /* Возвращаем ровно те позиции, что уходили в X2pos: строки заказа,
     сопоставленные с разновидностями через `variant.externalId`. */
  const items = await d
    .select({
      externalId: schema.variant.externalId,
      qty: schema.orderItem.qty,
      unitPriceKzt: schema.orderItem.unitPriceKzt,
    })
    .from(schema.orderItem)
    .innerJoin(schema.product, eq(schema.product.handle, schema.orderItem.productHandle))
    .innerJoin(
      schema.variant,
      and(eq(schema.variant.productId, schema.product.id), eq(schema.variant.isDefault, true)),
    )
    .where(eq(schema.orderItem.orderId, orderId));

  const lines: SaleLine[] = items
    .filter((i) => i.externalId)
    .map((i) => ({ variationId: i.externalId!, qty: i.qty, unitPriceKzt: i.unitPriceKzt }));

  if (lines.length === 0) {
    return { queued: false, cancelledPending: false, reason: "в заказе нет позиций из X2pos" };
  }

  const config = readConfig();
  const formGuid = crypto.randomUUID();
  const total = lines.reduce((s, l) => s + l.unitPriceKzt * l.qty, 0);

  await d.insert(schema.x2posOutbox).values({
    kind: "return",
    orderId,
    formGuid,
    payload: buildReturnPayload({
      formGuid,
      x2posOrderId: row.x2posOrderId,
      lines,
      totalKzt: total,
      branchId: config.branchId,
      kassaId: config.kassaId,
      employeeId: config.employeeId,
      cashAccountId: config.cashAccountId,
    }) as unknown as object,
  });

  return { queued: true, cancelledPending: false };
}
