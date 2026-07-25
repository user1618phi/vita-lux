import { defineRouting } from "next-intl/routing";

// Русский основной, казахский обязателен (см. CLAUDE.md).
export const routing = defineRouting({
  locales: ["ru", "kk"],
  defaultLocale: "ru",
});

export type Locale = (typeof routing.locales)[number];
