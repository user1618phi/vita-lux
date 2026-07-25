import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { CartProvider } from "@/context/CartContext";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Vita Lux — сантехника собственного производства",
  description: "Vita Lux — казахстанский производитель сантехники и мебели для ванной.",
};

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
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <CartProvider>{children}</CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
