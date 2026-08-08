import { defineRouting } from "next-intl/routing";
import { LOCALES, DEFAULT_LOCALE } from "@vita/i18n/locales";

// Русский основной, казахский обязателен (см. CLAUDE.md).
// Сам список живёт в @vita/i18n/locales: до него должны дотягиваться и пакеты
// (репозиторий каталога откатывается на defaultLocale, когда перевода нет),
// а импортировать код приложения им нельзя.
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
});

export type Locale = (typeof routing.locales)[number];
