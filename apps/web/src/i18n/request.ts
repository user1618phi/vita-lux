import { getRequestConfig } from "next-intl/server";
import { loadMessages } from "@vita/i18n/load";
import { routing, type Locale } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = routing.locales.includes(requested as Locale)
    ? (requested as Locale)
    : routing.defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
