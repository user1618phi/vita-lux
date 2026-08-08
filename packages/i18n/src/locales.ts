/* Единственный источник правды по списку локалей.

   Раньше пара `["ru", "kk"]` + «основной русский» была записана в
   `apps/web/src/i18n/routing.ts`, и добраться до неё из пакетов было нельзя:
   `@vita/data` не имеет права импортировать код приложения. Из-за этого
   репозиторий каталога не мог узнать, на какую локаль откатываться, когда у
   товара нет строки перевода.

   Модуль намеренно пустой по зависимостям — ни next-intl, ни React, ни узлов
   Node. Его тянут и серверные пакеты, и клиентские компоненты, и Node-скрипты. */

export const LOCALES = ["ru", "kk"] as const;

export type Locale = (typeof LOCALES)[number];

/** Локаль, на которой контент заводится в первую очередь. */
export const DEFAULT_LOCALE: Locale = "ru";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
