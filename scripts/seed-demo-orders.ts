/* Демонстрационные заказы.

   Запуск: DATABASE_URL=… APP_ENCRYPTION_KEY=… APP_HASH_SALT=… \
           pnpm db:demo-orders           создать
           pnpm db:demo-orders -- --clean удалить

   Зачем. Сайт ещё не продал ничего, поэтому экраны «Заказы» и половина
   графиков Сводки пусты, и посмотреть, как панель выглядит в работе,
   невозможно. Эти заказы заполняют её тем, чем она наполнится сама, когда
   пойдут настоящие покупки: разные статусы, разные способы оплаты и доставки,
   разброс по датам, живые товары из каталога, зашифрованные ПД, атрибуция.

   ЧЕГО ЭТОТ СКРИПТ НЕ ДЕЛАЕТ, и это главное.

   Он НЕ кладёт ничего в `x2pos_outbox`. Настоящий заказ ставит туда задание, и
   воркер создаёт в X2pos продажу со статусом `issued` — списывая реальный
   остаток со склада владельца и попадая в его отчётность. Выдуманный заказ,
   доехавший до X2pos, — это выдуманная продажа в чужой бухгалтерии. Поэтому
   очередь здесь не трогается вовсе, а `x2posOrderId` заполняется правдоподобным
   номером-заглушкой, который ни на что не ссылается.

   Все созданные строки помечены `idempotencyKey` с префиксом `demo-`, по нему
   же они и удаляются. Реф-коды начинаются с `VLD` вместо `VL`, чтобы демо было
   видно в списке с одного взгляда. */

import { eq, like } from "drizzle-orm";
import { db, schema } from "@vita/db/client";
import { encryptPii, hashPii } from "@vita/core/crypto";
import { CONSENT_VERSION } from "@vita/core/order/consent";

const CLEAN = process.argv.includes("--clean");
const MARKER = "demo-";

/* Реальные города присутствия и правдоподобные имена. Телефоны — из диапазона
   +7 700 000-00-xx, который операторы не выдают: позвонить по ним нельзя. */
const PEOPLE: { name: string; phone: string; city: string; address: string }[] = [
  { name: "Ерлан Сатыбалдиев", phone: "+77000000011", city: "Шымкент", address: "мкр Нурсат, д. 12, кв. 45" },
  { name: "Айгүл Нұрланова", phone: "+77000000012", city: "Алматы", address: "ул. Розыбакиева, д. 247, кв. 8" },
  { name: "Дмитрий Ким", phone: "+77000000013", city: "Астана", address: "пр. Кабанбай батыра, д. 40, кв. 112" },
  { name: "Мұрат Әбдіров", phone: "+77000000014", city: "Тараз", address: "ул. Толе би, д. 71" },
  { name: "Ольга Литвиненко", phone: "+77000000015", city: "Шымкент", address: "ул. Байтурсынова, д. 3, кв. 27" },
  { name: "Нұрсұлтан Жақсылық", phone: "+77000000016", city: "Кызылорда", address: "мкр Сырдария, д. 5" },
  { name: "Асель Тұрғанбай", phone: "+77000000017", city: "Шымкент", address: "ул. Мангельдина, д. 18, кв. 3" },
  { name: "Виктор Пак", phone: "+77000000018", city: "Алматы", address: "ул. Гоголя, д. 86, кв. 51" },
];

const DELIVERY = ["courier", "pickup"] as const;
const PAYMENT = ["kaspi", "card", "cash", "install"] as const;
const STATUS = ["new", "confirmed", "shipped", "done", "cancelled"] as const;

/* Распределение статусов как в живом магазине: большинство доведено до конца,
   пара свежих, одна отмена. Ровное распределение выглядело бы синтетикой. */
const STATUS_PLAN: (typeof STATUS)[number][] = [
  "done", "done", "done", "done", "done", "done",
  "shipped", "shipped", "shipped",
  "confirmed", "confirmed",
  "new", "new",
  "cancelled",
];

/* `channel` — то, чем этот заказ считается в отчётности (site / instagram /
   whatsapp / kaspi), utm_* — как человек пришёл. Поля разные и заполняются
   независимо, ровно как их пишет middleware витрины. */
const SOURCES: {
  channel: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
}[] = [
  { channel: "site", utmSource: "google", utmMedium: "organic", utmCampaign: null, referrer: "https://www.google.com/" },
  { channel: "instagram", utmSource: "instagram", utmMedium: "social", utmCampaign: "vitalux_july", referrer: "https://l.instagram.com/" },
  { channel: "site", utmSource: "2gis", utmMedium: "referral", utmCampaign: null, referrer: "https://2gis.kz/" },
  { channel: "site", utmSource: null, utmMedium: null, utmCampaign: null, referrer: null },
  { channel: "site", utmSource: "google", utmMedium: "cpc", utmCampaign: "santehnika_shymkent", referrer: "https://www.google.com/" },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL не задан");
    process.exit(1);
  }
  if (!CLEAN && (!process.env.APP_ENCRYPTION_KEY || !process.env.APP_HASH_SALT)) {
    console.error("Нужны APP_ENCRYPTION_KEY и APP_HASH_SALT — ПД заказа шифруются.");
    process.exit(1);
  }

  const d = db();

  if (CLEAN) {
    /* Атрибуция ссылается на заказ через `on delete set null`, а не cascade:
       отчёт о канале переживает удаление заказа намеренно. Значит демо-строки
       надо убрать отдельно, иначе они останутся висеть без хозяина. */
    const attrs = await d
      .delete(schema.attribution)
      .where(like(schema.attribution.sessionId, `${MARKER}%`))
      .returning({ id: schema.attribution.id });
    const rows = await d
      .delete(schema.order)
      .where(like(schema.order.idempotencyKey, `${MARKER}%`))
      .returning({ ref: schema.order.refCode });
    /* Позиции заказа уходят каскадом — у них on delete cascade. */
    console.log(`✓ удалено демо-заказов: ${rows.length}, строк атрибуции: ${attrs.length}`);
    process.exit(0);
  }

  const existing = await d
    .select({ id: schema.order.id })
    .from(schema.order)
    .where(like(schema.order.idempotencyKey, `${MARKER}%`));
  if (existing.length > 0) {
    console.log(`→ демо-заказы уже есть (${existing.length}). Сначала: pnpm db:demo-orders -- --clean`);
    process.exit(0);
  }

  /* Товары берём только те, что реально можно купить на сайте: опубликованные
     и с ценой. Заказ на товар «Цена по запросу» невозможен по правилам
     оформления, и подделывать его — значит рисовать состояние, которого в
     системе не бывает. */
  const products = await d
    .select({
      variantId: schema.variant.id,
      sku: schema.variant.sku,
      handle: schema.product.handle,
      name: schema.productI18n.name,
      price: schema.price.retailKzt,
    })
    .from(schema.product)
    .innerJoin(schema.variant, eq(schema.variant.productId, schema.product.id))
    .innerJoin(schema.price, eq(schema.price.variantId, schema.variant.id))
    .leftJoin(schema.productI18n, eq(schema.productI18n.productId, schema.product.id))
    .where(eq(schema.product.status, "active"));

  const sellable = products.filter((p) => p.price !== null && p.price > 0);
  if (sellable.length === 0) {
    console.error("✗ в каталоге нет ни одного опубликованного товара с ценой — нечего заказывать");
    process.exit(1);
  }

  const settings = await d.select().from(schema.setting);
  const byKey = new Map(settings.map((s) => [s.key, Number(s.value)]));
  const freeFrom = byKey.get("delivery.freeFromKzt") ?? 150_000;
  const deliveryCost = byKey.get("delivery.costKzt") ?? 3_900;

  let made = 0;
  for (const [i, status] of STATUS_PLAN.entries()) {
    const who = PEOPLE[i % PEOPLE.length];
    /* Даты вразброс по последним десяти неделям, свежие — сверху списка. */
    const daysAgo = Math.round(2 + i * 4.7);
    const createdAt = new Date(Date.now() - daysAgo * 86_400_000 - i * 3_600_000);

    const lineCount = 1 + (i % 3);
    const picked = Array.from({ length: lineCount }, (_, k) => sellable[(i * 3 + k) % sellable.length]);
    const items = picked.map((p, k) => {
      const qty = k === 0 ? 1 + (i % 2) : 1;
      const unit = p.price!;
      return {
        variantId: p.variantId,
        sku: p.sku,
        productHandle: p.handle,
        nameSnapshot: p.name ?? p.handle,
        unitPriceKzt: unit,
        qty,
        lineTotalKzt: unit * qty,
      };
    });

    const subtotal = items.reduce((a, it) => a + it.lineTotalKzt, 0);
    const deliveryMethod = DELIVERY[i % DELIVERY.length];
    const deliveryKzt = deliveryMethod === "pickup" || subtotal >= freeFrom ? 0 : deliveryCost;
    const total = subtotal + deliveryKzt;

    await d.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.order)
        .values({
          /* VLD вместо VL — демо видно в списке сразу. */
          refCode: `VLD-${String(1000 + i)}`,
          status,
          locale: i % 4 === 0 ? "kk" : "ru",
          subtotalKzt: subtotal,
          deliveryKzt,
          totalKzt: total,
          deliveryMethod,
          paymentMethod: PAYMENT[i % PAYMENT.length],
          city: who.city,
          comment: i % 5 === 0 ? "Позвонить за час до доставки" : null,
          nameEnc: encryptPii(who.name),
          phoneEnc: encryptPii(who.phone),
          phoneHash: hashPii(who.phone),
          addressEnc: deliveryMethod === "courier" ? encryptPii(who.address) : null,
          consentVersion: CONSENT_VERSION,
          consentAt: createdAt,
          idempotencyKey: `${MARKER}${i}-${createdAt.getTime()}`,
          notifyStatus: i === 3 ? "failed" : "sent",
          adminNote: "Демонстрационный заказ. Удаляется: pnpm db:demo-orders -- --clean",
          createdAt,
          confirmedAt: status === "new" || status === "cancelled" ? null : createdAt,
          /* Правдоподобный номер продажи в X2pos — но НИЧЕГО в X2pos не
             создаётся и в очередь не ставится. См. шапку файла. */
          x2posOrderId: status === "new" || status === "cancelled" ? null : `demo-${52_600_000 + i}`,
        })
        .returning({ id: schema.order.id });

      await tx.insert(schema.orderItem).values(items.map((it) => ({ ...it, orderId: row.id })));

      const src = SOURCES[i % SOURCES.length];
      await tx.insert(schema.attribution).values({
        orderId: row.id,
        sessionId: `${MARKER}session-${i}`,
        channel: src.channel,
        utmSource: src.utmSource,
        utmMedium: src.utmMedium,
        utmCampaign: src.utmCampaign,
        referrer: src.referrer,
        landingPath: i % 2 === 0 ? "/ru" : "/ru/catalog/toilets",
        firstTouchAt: new Date(createdAt.getTime() - 2 * 86_400_000),
        lastTouchAt: createdAt,
      });
    });

    made++;
    console.log(`  + VLD-${1000 + i}  ${status.padEnd(9)} ${String(total).padStart(8)} ₸  ${who.city}`);
  }

  console.log(`\n✓ создано демо-заказов: ${made}`);
  console.log("  В X2pos НИЧЕГО не отправлено: очередь не трогалась.");
  console.log("  Удалить: pnpm db:demo-orders -- --clean");
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ не удалось создать демо-заказы:", (err as Error).message);
  process.exit(1);
});
