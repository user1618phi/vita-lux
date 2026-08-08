import type { Metadata } from "next";
import { isPublicSite, siteUrl } from "@vita/core/site";
import { routing } from "@/i18n/routing";

/* Сборка метаданных страницы: canonical, hreflang, Open Graph и гейт индексации.

   Помощник существует, потому что Next НЕ сливает метаданные вглубь: значение
   ключа, заданное на странице, ЗАМЕНЯЕТ родительское целиком, а не дополняет
   его. Отсюда три следствия, которые ломали сайт по одному:

   1. Страница, задающая `openGraph`, теряла `siteName`, `type` и `locale` из
      layout — если не перечислит их заново. Поэтому объект здесь всегда полный.

   2. `alternates` заменяется так же. Это то, что нам и нужно: в layout canonical
      равен `${base}/${locale}`, то есть ГЛАВНОЙ, и до появления этого модуля
      каждая карточка товара объявляла канонической страницей главную. Для
      поиска это означало один документ вместо всего каталога.

   3. `robots` наследуется, если его не задать, — но это единственное, на что
      нельзя полагаться. Запрет индексации, пока не задан боевой домен, —
      требование CLAUDE.md («Не включай раньше, чем зайдут настоящие товары»), и
      оно не должно зависеть от того, переживёт ли наследование очередную
      правку layout. Поэтому эмитим явно на каждом уровне. */

export interface PageMetadataOptions {
  locale: string;
  /** Путь после локали: "/products/vl-3204". Для главной — пустая строка. */
  path: string;
  title: string;
  description: string;
  /** Абсолютный URL обложки для превью в мессенджерах и соцсетях. */
  image?: string;
  imageAlt?: string;
}

export function pageMetadata({
  locale,
  path,
  title,
  description,
  image,
  imageAlt,
}: PageMetadataOptions): Metadata {
  const base = siteUrl();
  const url = `${base}/${locale}${path}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `${base}/${l}${path}`])),
    },
    openGraph: {
      type: "website",
      siteName: "Vita Lux",
      locale: locale === "kk" ? "kk_KZ" : "ru_KZ",
      title,
      description,
      url,
      ...(image ? { images: [{ url: image, alt: imageAlt ?? title }] } : {}),
    },
    robots: isPublicSite() ? undefined : { index: false, follow: false },
  };
}
