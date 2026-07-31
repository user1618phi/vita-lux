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

/* По той же причине ключи, умолчания и разбор вынесены в `./settings.keys`:
   воркеру синхронизации на Railway они нужны, а `next/cache` и драйвер БД из
   этого модуля — нет. Здесь только чтение и кэш. */
export {
  SETTING_DEFAULTS,
  SETTING_KEYS,
  parseSettings,
  type StoreSettings,
} from "./settings.keys";
import { SETTING_DEFAULTS, parseSettings, type StoreSettings } from "./settings.keys";

async function load(): Promise<StoreSettings> {
  if (!hasDatabase()) return SETTING_DEFAULTS;

  try {
    const rows = await db().select().from(schema.setting);
    return parseSettings(rows);
  } catch {
    // Never let a settings read take the storefront down.
    return SETTING_DEFAULTS;
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
