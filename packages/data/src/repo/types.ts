import type { CatalogItem, CategoryFilterConfig, FlushType, SeatMaterial } from "@vita/core/catalog";

/* Read model returned by the catalog repository.

   The important difference from `CatalogItem`: `name` is already resolved for
   the requested locale. Pages must never look a name up themselves — today the
   mock source reads it from messages/*.json, tomorrow the DB source reads it
   from `product_i18n`, and no page changes. */

export interface CatalogEntry extends CatalogItem {
  /** Product name, already localized. Never a raw handle. */
  name: string;
  /** No price is published — render "Цена по запросу", disallow adding to cart. */
  priceOnRequest: boolean;
  /** Brand code, e.g. "vita-lux" | "smoow". Absent on mock data. */
  brandCode?: string;
}

/* Редакторская часть карточки: описание, SEO и характеристики, которые нужны
   ровно одной странице.

   Отдельная модель, а не поля в `CatalogEntry`, по трём причинам.

   `CatalogEntry` — это формат снапшота, который корзина и избранное кладут в
   localStorage браузера (см. LineSnapshot в apps/web/src/app/actions/catalog).
   Описание на 4000 символов там не место, а поле в общем типе рано или поздно
   уедет туда через `...item`.

   `CatalogEntry` кэшируется категориями целиком: `listCategoryItems` держит в
   одной записи `unstable_cache` весь раздел. Описания раздули бы этот кэш ради
   данных, которые читает одна страница из всего сайта.

   И мок-источник заполнить эти поля не может — в мок-каталоге редакторских
   текстов нет. Поле, которое в одном из двух взаимозаменяемых источников
   всегда undefined, — это ложь в интерфейсе. */
export interface ProductDetail {
  handle: string;
  subtitle?: string;
  /** Описание как его написали: разбирается @vita/core/markdown, не HTML. */
  descriptionMd?: string;
  seoTitle?: string;
  seoDescription?: string;
  widthMm?: number;
  depthMm?: number;
  heightMm?: number;
  flushType?: FlushType;
  seatMaterial?: SeatMaterial;
}

export interface CategorySummary {
  slug: string;
  itemCount: number;
}

/** A cart line joined against the catalog, resolved server-side. */
export interface ResolvedLine {
  item: CatalogEntry;
  qty: number;
}

/** Everything a catalog source must implement. Mock and DB both satisfy this. */
export interface CatalogSource {
  listCategoryItems(category: string, locale: string): Promise<CatalogEntry[]>;
  getItem(handle: string, locale: string): Promise<CatalogEntry | null>;
  /** Редакторская часть карточки. Мок-источник её не заполняет и отдаёт null. */
  getProductDetail(handle: string, locale: string): Promise<ProductDetail | null>;
  listHandles(): Promise<string[]>;
  listCategories(): Promise<CategorySummary[]>;
  getFilterConfig(category: string): Promise<CategoryFilterConfig | null>;
  getHomeHits(locale: string, count: number): Promise<CatalogEntry[]>;
  resolveLines(handles: { handle: string; qty: number }[], locale: string): Promise<ResolvedLine[]>;
}
