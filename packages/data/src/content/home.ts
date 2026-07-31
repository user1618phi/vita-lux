import type { IconName } from "@vita/core/icons";
import { catalogItems } from "./catalog";
import type { CatalogItem } from "@vita/core/catalog";
import { img } from "@vita/core/img";

/* Home page configuration. Display copy lives in messages/*.json (namespace
   `Home` + category names from `Nav`); this module holds structure, imagery and
   the selection logic over the existing catalog. Все товары — Vita Lux. */

export const HERO_IMAGE = img("1756079664354-34944e001f6d", 1600, 1000);
export const DELIVERY_IMAGE = img("1613849925362-38fb4c16ff36", 1000, 800);

export interface HomeCategory {
  slug: string; // catalog category slug (route /catalog/[slug])
  icon: IconName;
  image: string;
  live: boolean; // whether /catalog/[slug] has items
}

/* Order matches the header nav. All five categories now have catalog items. */
export const homeCategories: HomeCategory[] = [
  { slug: "faucets", icon: "package", image: img("1773177930149-48a2f5df9e07", 600, 800), live: true },
  { slug: "sinks", icon: "package", image: img("1595514535316-b8c85bf9bbf9", 600, 800), live: true },
  { slug: "toilets", icon: "package", image: img("1611066415697-7f58dc0a5d10", 600, 800), live: true },
  { slug: "bath", icon: "package", image: img("1507652313519-d4e9174996dd", 600, 800), live: true },
  { slug: "furniture", icon: "package", image: img("1682888818696-906287d759f5", 600, 800), live: true },
];

/* Editorial collections — a Vita Lux-specific device (brand storytelling) that
   the generic reseller design lacks. Each links into the catalog pre-filtered. */
export interface HomeCollection {
  slug: string; // "aura" | "standart" | "bronze"
  image: string;
}
export const homeCollections: HomeCollection[] = [
  { slug: "aura", image: img("1595514535316-b8c85bf9bbf9", 800, 500) },
  { slug: "standart", image: img("1682888818696-906287d759f5", 800, 500) },
  { slug: "bronze", image: img("1613849925362-38fb4c16ff36", 800, 500) },
];

/* Contact channel. In production the WhatsApp refCode is generated server-side
   and written to the DB with sessionId/utm (см. бриф) — this is the click
   surface only. */
export const HOME_PHONE = "77079961717";

/** Карточка склада в 2ГИС — по ней открывается адрес из подвала.
    2ГИС, а не Google Maps: в Казахстане маршруты строят в нём, и карточка
    сразу отдаёт телефон, часы и проезд. Ссылка ведёт на конкретный geo-объект,
    поэтому при переезде её меняют вместе с текстом адреса в локалях. */
export const MAP_URL = "https://2gis.kz/shymkent/geo/22659371323306831";

/** Hits row: badge hit/new first, then fill to `count` with in-stock items. */
export function getHomeHits(count = 8): CatalogItem[] {
  const featured = catalogItems.filter((it) => it.badge === "hit" || it.badge === "new");
  const rest = catalogItems.filter((it) => !featured.includes(it) && it.stock === "in");
  return [...featured, ...rest].slice(0, count);
}
