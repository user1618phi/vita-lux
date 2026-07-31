import "server-only";
import { unstable_cache } from "next/cache";
import { db, hasDatabase, schema } from "@vita/db/client";

/* Runtime configuration, editable from the admin panel.

   These were hardcoded across the storefront (the free-delivery threshold in
   CheckoutView, the phone in data/home.ts, the Almaty address in the footer
   copy). Reading them from here means the brother can fix a phone number
   without a deploy — and the defaults below keep everything working before the
   database exists. */

/* Тег живёт в `./repo/tags` вместе с остальными — админке нужно его имя, но не
   нужен этот модуль целиком (он `server-only` и тянет драйвер БД). */
export { SETTINGS_TAG } from "./repo/tags";
import { SETTINGS_TAG } from "./repo/tags";

export interface StoreSettings {
  phonePrimary: string;
  phoneSecondary: string;
  city: string;
  address: string;
  freeFromKzt: number;
  deliveryCostKzt: number;
  installmentMonths: number;
  installmentEnabled: boolean;
}

/* Defaults match what the code shipped with, so nothing changes behaviour
   until a real value is entered in the admin. */
const DEFAULTS: StoreSettings = {
  phonePrimary: "77079961717",
  phoneSecondary: "",
  city: "",
  address: "",
  freeFromKzt: 150000,
  deliveryCostKzt: 3900,
  installmentMonths: 24,
  installmentEnabled: true,
};

/* Экспортируется, чтобы админка валидировала запись по тому же списку, по
   которому витрина читает. Раньше форма писала любой ключ вида `setting.*`, и
   подделанный POST мог насыпать в таблицу произвольные строки; а ключи
   `pricing.*` форма писала годами, притом что читателя у них не было. */
export const SETTING_KEYS: Record<keyof StoreSettings, string> = {
  phonePrimary: "contact.phonePrimary",
  phoneSecondary: "contact.phoneSecondary",
  city: "contact.city",
  address: "contact.address",
  freeFromKzt: "delivery.freeFromKzt",
  deliveryCostKzt: "delivery.costKzt",
  installmentMonths: "installment.months",
  installmentEnabled: "installment.enabled",
};

async function load(): Promise<StoreSettings> {
  if (!hasDatabase()) return DEFAULTS;

  try {
    const rows = await db().select().from(schema.setting);
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    const out = { ...DEFAULTS };

    for (const [field, key] of Object.entries(SETTING_KEYS) as [keyof StoreSettings, string][]) {
      const raw = byKey.get(key);
      if (raw === undefined || raw === null || raw === "") continue;

      const fallback = DEFAULTS[field];
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
  } catch {
    // Never let a settings read take the storefront down.
    return DEFAULTS;
  }
}

/* revalidate — та же страховка, что в repo/index.ts: сброс приезжает вебхуком
   из другого деплоймента и может не дойти. Настройки особенно чувствительны —
   до появления вебхука `revalidateTag(SETTINGS_TAG)` не вызывался НИГДЕ, и
   смена телефона не доезжала до сайта вообще никогда. */
export const getSettings = unstable_cache(load, ["store-settings"], {
  tags: [SETTINGS_TAG],
  revalidate: 300,
});
