import "server-only";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db, schema } from "@vita/db/client";
import { createClient } from "@vita/x2pos/client";
import { isX2posEnabled, readConfig } from "@vita/x2pos/config";
import { X2POS_SOURCE, qtyToStockState } from "@vita/x2pos/map";
import { buildSalePayload, type SaleLine } from "@vita/x2pos/sync/outbox";

/* Связь оформления заказа с X2pos.

   Две обязанности, и обе — «мягкие»: ни одна из них не имеет права помешать
   человеку оформить заказ. Если X2pos недоступен, магазин продолжает
   торговать, а продажа догонит из очереди.

   ПД сюда не попадают. В `notes` уходит только реф-код, способ доставки и
   город — этого достаточно, чтобы продавец нашёл заказ в админке, а имя и
   телефон остаются в зашифрованных колонках `order`. */

export interface LineWithVariant {
  handle: string;
  qty: number;
  unitPriceKzt: number;
  variantId: string;
  /** ID разновидности в X2pos. null — товар не из X2pos (мок или ручной). */
  externalId: string | null;
}

/**
 * Достаёт для каждой позиции корзины её вариант и внешний ID в X2pos.
 *
 * Джойн идёт по `handle`, а не по SKU: артикулы в прайсе повторяются, и
 * unique-индекса на `variant.sku` в схеме нет намеренно.
 */
export async function resolveVariants(
  lines: { handle: string; qty: number; unitPriceKzt: number }[],
): Promise<LineWithVariant[]> {
  if (lines.length === 0) return [];

  const rows = await db()
    .select({
      handle: schema.product.handle,
      variantId: schema.variant.id,
      externalId: schema.variant.externalId,
    })
    .from(schema.variant)
    .innerJoin(schema.product, eq(schema.product.id, schema.variant.productId))
    .where(
      and(
        inArray(
          schema.product.handle,
          lines.map((l) => l.handle),
        ),
        eq(schema.variant.isDefault, true),
      ),
    );

  const byHandle = new Map(rows.map((r) => [r.handle, r]));
  return lines.flatMap((l) => {
    const row = byHandle.get(l.handle);
    if (!row) return [];
    return [{ ...l, variantId: row.variantId, externalId: row.externalId }];
  });
}

/**
 * Пересчитывает наличие по живому ответу X2pos прямо перед созданием заказа.
 *
 * `/api/stock` отвечает за ~90 мс, поэтому проверка укладывается в оформление
 * и закрывает окно между прогонами крона: за пять минут товар вполне может
 * уйти покупателю в магазине.
 *
 * Возвращает хендлы, которых на складе больше нет. При любой ошибке — пустой
 * список: X2pos лежит, значит опираемся на `inventory` из своей БД. Отказ
 * оформления из-за недоступного склада хуже, чем риск перепродажи, который и
 * так покрыт буфером.
 */
export async function findSoldOut(
  lines: LineWithVariant[],
  bufferQty: number,
): Promise<string[]> {
  const tracked = lines.filter((l) => l.externalId);
  if (!isX2posEnabled() || tracked.length === 0) return [];

  try {
    const stock = await createClient({ config: readConfig(), timeoutMs: 3_000 }).getStock();
    return tracked
      .filter((l) => {
        const qty = stock.get(l.externalId!) ?? 0;
        /* Сравниваем с запрошенным количеством, а не с нулём: две штуки при
           остатке в одну — это тоже «нет в наличии». Буфер оставляем магазину. */
        return qty - bufferQty < l.qty && qtyToStockState(qty, bufferQty) !== "in";
      })
      .map((l) => l.handle);
  } catch {
    return [];
  }
}

/**
 * Кладёт продажу в очередь на отправку в X2pos.
 *
 * Вызывается ВНУТРИ той же транзакции, что создаёт заказ: либо есть и заказ, и
 * задание на его отправку, либо нет ничего. Промежуточного состояния
 * «заказ принят, но склад о нём никогда не узнает» не существует.
 */
export async function enqueueSale(
  tx: Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0],
  input: { orderId: string; refCode: string; lines: LineWithVariant[]; note: string },
): Promise<void> {
  if (!isX2posEnabled()) return;

  const saleLines: SaleLine[] = input.lines
    .filter((l) => l.externalId)
    .map((l) => ({ variationId: l.externalId!, qty: l.qty, unitPriceKzt: l.unitPriceKzt }));

  /* В заказе нет ни одной позиции из X2pos — отправлять нечего. */
  if (saleLines.length === 0) return;

  const config = readConfig();
  const formGuid = crypto.randomUUID();

  await tx.insert(schema.x2posOutbox).values({
    kind: "sale",
    orderId: input.orderId,
    formGuid,
    payload: buildSalePayload({
      formGuid,
      refCode: input.refCode,
      lines: saleLines,
      branchId: config.branchId,
      kassaId: config.kassaId,
      userId: config.userId,
      channel: config.channel,
      note: input.note,
      orderDate: new Date(),
    }) as unknown as object,
  });
}

/**
 * Пытается отправить очередь немедленно, чтобы продавец увидел заказ в кассе
 * сразу, а не через пять минут.
 *
 * НИКОГДА не бросает — ровно по той же причине, что и `publish()` в админке:
 * вызов стоит после успешного коммита, и падение сети не должно превращаться в
 * «не удалось оформить заказ» на уже оформленном заказе.
 */
export async function tryDeliverNow(): Promise<void> {
  if (!isX2posEnabled()) return;
  try {
    const { processOutbox } = await import("@vita/x2pos/sync/outbox");
    await processOutbox({ db: db(), client: createClient({ config: readConfig(), timeoutMs: 4_000 }), limit: 5 });
  } catch {
    /* Заберёт крон. Логировать нечего: в очереди заказы, а payload заказа
       проект не логирует ни при каких обстоятельствах. */
  }
}

/** Товары из X2pos, ещё не выгруженные в него. Для страницы состояния. */
export async function pendingSaleCount(): Promise<number> {
  const rows = await db()
    .select({ id: schema.x2posOutbox.id })
    .from(schema.x2posOutbox)
    .where(and(eq(schema.x2posOutbox.kind, "sale"), isNotNull(schema.x2posOutbox.formGuid)));
  return rows.length;
}

export { X2POS_SOURCE };
