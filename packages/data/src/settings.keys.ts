/* Ключи, умолчания и разбор настроек — БЕЗ `server-only`.

   Тот же приём, что и с `./repo/tags`: сам `settings.ts` помечен server-only и
   тянет драйвер БД с `next/cache`, поэтому из обычного Node-процесса (воркер
   синхронизации на Railway, скрипты) его импортировать нельзя. А знать имена
   ключей и умолчания этим потребителям надо.

   Дублировать список в воркере было бы хуже: он бы разошёлся с витриной ровно
   в тот день, когда кто-то добавит настройку и забудет про вторую копию. */

export interface StoreSettings {
  phonePrimary: string;
  phoneSecondary: string;
  city: string;
  address: string;
  freeFromKzt: number;
  deliveryCostKzt: number;
  installmentMonths: number;
  installmentEnabled: boolean;

  /* Синхронизация с X2pos. Это решения владельца, а не конфигурация
     деплоя, поэтому они живут в БД, а не в переменных окружения. */

  /** Сколько штук не показывать на сайте. Резерва в X2pos нет, и он разрешает
      уходить в минус, поэтому последние единицы придерживаем. */
  stockBufferQty: number;
  /** Наценка к цене из X2pos в базисных пунктах. 0 — цена как в X2pos. */
  globalMarkupBp: number;
  /** Показывать оптовую цену рядом с розничной. */
  showWholesale: boolean;
}

/* Умолчания совпадают с тем, с чем код ехал раньше, чтобы до первой записи в
   админке ничего не менялось. */
export const SETTING_DEFAULTS: StoreSettings = {
  phonePrimary: "77079961717",
  phoneSecondary: "",
  city: "",
  address: "",
  freeFromKzt: 150000,
  deliveryCostKzt: 3900,
  installmentMonths: 24,
  installmentEnabled: true,
  stockBufferQty: 3,
  /* Ноль намеренно: включение синхронизации не должно молча сдвинуть ни одну
     цену. Любая наценка — явное решение в админке. */
  globalMarkupBp: 0,
  showWholesale: true,
};

export const SETTING_KEYS: Record<keyof StoreSettings, string> = {
  phonePrimary: "contact.phonePrimary",
  phoneSecondary: "contact.phoneSecondary",
  city: "contact.city",
  address: "contact.address",
  freeFromKzt: "delivery.freeFromKzt",
  deliveryCostKzt: "delivery.costKzt",
  installmentMonths: "installment.months",
  installmentEnabled: "installment.enabled",
  stockBufferQty: "stock.bufferQty",
  globalMarkupBp: "pricing.globalMarkupBp",
  showWholesale: "pricing.showWholesale",
};

/** Чистый разбор строк таблицы `setting` в типизированные настройки. */
export function parseSettings(rows: { key: string; value: unknown }[]): StoreSettings {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out = { ...SETTING_DEFAULTS };

  for (const [field, key] of Object.entries(SETTING_KEYS) as [keyof StoreSettings, string][]) {
    const raw = byKey.get(key);
    if (raw === undefined || raw === null || raw === "") continue;

    const fallback = SETTING_DEFAULTS[field];
    if (typeof fallback === "number") {
      const n = Number(raw);
      if (Number.isFinite(n)) (out[field] as number) = n;
    } else if (typeof fallback === "boolean") {
      (out[field] as boolean) = raw === true || raw === 1 || raw === "1" || raw === "true";
    } else {
      (out[field] as string) = String(raw);
    }
  }
  return out;
}
