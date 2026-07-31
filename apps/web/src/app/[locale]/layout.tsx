import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { CartProvider } from "@/context/CartContext";
import { Analytics } from "@/components/analytics/Analytics";
import { ThemeScript } from "@vita/ui/theme/script";
import { DEFAULT_THEME, THEME_COLOR } from "@vita/ui/theme";
import { isPublicSite, siteUrl } from "@vita/core/site";
import "@/styles/globals.css";

/* Paints the mobile browser chrome to match the page. Without it iOS Safari
   keeps a white bar above the dark page.
   Одно значение, а не пара media-запросов: тему выбирает сайт, а не система, —
   привязка к prefers-color-scheme красила бы панель в светлое над тёмной
   страницей. Переключатель правит этот тег на лету (см. ThemeToggle). */
export const viewport: Viewport = {
  themeColor: THEME_COLOR[DEFAULT_THEME],
};

/* Metadata used to be a hardcoded Russian object, so Kazakh pages advertised a
   Russian title and description to search engines and to anyone sharing a link. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  const base = siteUrl();

  return {
    metadataBase: new URL(base),
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `${base}/${locale}`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `${base}/${l}`])),
    },
    icons: {
      icon: [
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/apple-icon.png",
    },
    openGraph: {
      type: "website",
      siteName: "Vita Lux",
      locale: locale === "kk" ? "kk_KZ" : "ru_KZ",
      title: t("title"),
      description: t("description"),
      url: `${base}/${locale}`,
    },
    // Keep placeholder prices out of search results until a real domain is set.
    robots: isPublicSite() ? undefined : { index: false, follow: false },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <ThemeScript />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <CartProvider>{children}</CartProvider>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
