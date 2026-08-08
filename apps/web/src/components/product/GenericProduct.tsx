import { getLocale, getTranslations } from "next-intl/server";

import { SiteHeader } from "@/components/navigation/SiteHeader";
import { SiteFooter } from "@/components/navigation/SiteFooter";
import { MobileTabBar } from "@/components/navigation/MobileTabBar";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PriceTag } from "@/components/ui/PriceTag";
import { StockStatus } from "@/components/ui/StockStatus";
import { SpecRow } from "@/components/ui/SpecRow";
import { ProductCard } from "@/components/ui/ProductCard";
import { Icon, type IconName } from "@/components/ui/Icon";

import { PhotoGallery } from "@/components/product/PhotoGallery";
import { AddToCartButton } from "@/components/product/AddToCartButton";
import { KaspiAction, WhatsAppAction } from "@/components/product/ChannelActions";
import { MobileStickyBar } from "@/components/product/MobileStickyBar";

import { HOME_PHONE } from "@vita/data/content/home";
import { listCategoryItems, type CatalogEntry, type ProductDetail } from "@vita/data/repo";
import { ProductJsonLd } from "@/components/seo/ProductJsonLd";
import { ProductDescription } from "@/components/product/ProductDescription";
import { KaspiGlyph } from "@/components/ui/KaspiGlyph";
import { benefitPercent, formatDimensions, formatTenge, formatTengePlain, installmentPerMonth } from "@vita/core/format";
import { SITE_DOMAIN } from "@vita/core/site";

type Trust = { title: string; text: string };
type Spec = { label: string; value: string; unit?: string };

const CARD = "bg-glaze border-[0.5px] border-line rounded-lg";
const H2 = "m-0 font-display font-normal text-ink text-[20px] lg:text-[30px]";
const TRUST_ICONS: IconName[] = ["shield-check", "package", "home"];

/* GenericProduct — data-driven product page for every catalog item (real photos,
   price, Kaspi installment, stock, add-to-cart + WhatsApp, spec list from
   structured fields). Fully ru/kk. Monobrand — бренд всегда Vita Lux. */

export async function GenericProduct({
  item,
  detail,
}: {
  item: CatalogEntry;
  detail?: ProductDetail | null;
}) {
  const locale = await getLocale();
  const t = await getTranslations("Product");
  const tpg = await getTranslations("ProductGeneric");
  const tCat = await getTranslations("Catalog");
  const tCategories = await getTranslations("Categories");
  const tFilters = await getTranslations("Filters");
  const tStock = await getTranslations("Stock");
  const tPrice = await getTranslations("Price");

  const name = item.name;
  /* Коллекция и отделка есть не у всех: источник каталога подставляет "" вместо
     NULL, а next-intl на пустом ключе печатает сам путь — над заголовком
     вставало «Коллекция Filters.collections.». Условие обязано стоять здесь, а
     не в разметке: строка вычисляется до неё. */
  const collectionName = item.collection ? tFilters(`collections.${item.collection}`) : undefined;
  const finishName = item.finish ? tFilters(`finishes.${item.finish}`) : undefined;
  const materialName = item.material ? tFilters(`materials.${item.material}`) : undefined;
  const categoryName = tCategories(`${item.category}.breadcrumb`);

  const { price, oldPrice, wholesalePrice, installmentMonths: months } = item;
  const pct = oldPrice ? benefitPercent(oldPrice, price) : 0;
  const benefitText = pct > 0 ? tPrice("benefit", { pct }) : undefined;
  /* Склад оптовый, и на карточке товара оптовая цена — половина причины, по
     которой сюда приходят. Строку собираем здесь: компоненты денег не форматируют. */
  const wholesaleText = wholesalePrice
    ? tPrice("wholesaleFrom", { price: formatTenge(wholesalePrice) })
    : undefined;
  const perMonth = installmentPerMonth(price, months);
  const perMonthUnit = t("perMonthUnit", { months });
  /* См. комментарий в products/[handle]/page.tsx: у «Спросить» и «Рассрочки»
     разные заготовки, иначе менеджер не видит, с каким вопросом пришли. */
  const waParams = { site: SITE_DOMAIN, name, sku: item.sku, price: formatTengePlain(price) };
  const waMessage = item.priceOnRequest ? t("waAskNoPrice", waParams) : t("waAsk", waParams);
  const waInstallment = t("waInstallment", { ...waParams, months });
  const gallery = item.gallery?.length ? item.gallery : item.image ? [item.image] : [];

  const crumbs = [
    { label: tCat("home"), href: "/" as const },
    { label: categoryName, href: `/catalog/${item.category}` },
    { label: name },
  ];

  const trust = (t.raw("trust") as Trust[]).map((tr, i) => ({ ...tr, icon: TRUST_ICONS[i] }));

  /* Габариты идут первой строкой: для сантехники это первый вопрос покупателя —
     влезет ли в санузел. Полная тройка собирается в «Ш × Г × В»; если известны
     не все три (обычное дело для запчастей), formatDimensions молчит и размеры
     выводятся по одному под своими подписями — иначе строка утверждала бы про
     габариты то, чего мы не знаем. */
  const dims = formatDimensions(detail?.widthMm, detail?.depthMm, detail?.heightMm);
  const mm = tpg("unitMm");
  const partialDims: Spec[] = dims
    ? []
    : [
        ...(detail?.widthMm ? [{ label: tpg("specWidth"), value: String(detail.widthMm), unit: mm }] : []),
        ...(detail?.depthMm ? [{ label: tpg("specDepth"), value: String(detail.depthMm), unit: mm }] : []),
        ...(detail?.heightMm ? [{ label: tpg("specHeight"), value: String(detail.heightMm), unit: mm }] : []),
      ];

  const keySpecs: Spec[] = [
    ...(dims ? [{ label: tpg("specDimensions"), value: dims, unit: mm }] : partialDims),
    ...(collectionName ? [{ label: tpg("specCollection"), value: collectionName }] : []),
    ...(finishName ? [{ label: tpg("specFinish"), value: finishName }] : []),
    ...(materialName ? [{ label: tpg("specMaterial"), value: materialName }] : []),
    ...(item.outletType ? [{ label: tpg("specOutlet"), value: tFilters(`outlet.${item.outletType}`) }] : []),
    ...(item.mountType ? [{ label: tpg("specMount"), value: tFilters(`mount.${item.mountType}`) }] : []),
    ...(detail?.flushType ? [{ label: tpg("specFlush"), value: tFilters(`flush.${detail.flushType}`) }] : []),
    ...(detail?.seatMaterial ? [{ label: tpg("specSeat"), value: tFilters(`seat.${detail.seatMaterial}`) }] : []),
    { label: tpg("specCategory"), value: categoryName },
    { label: tpg("warranty"), value: tpg("warrantyValue") },
  ];

  const cardLabels = {
    stock: tStock("in"),
    addToCart: t("addToCart"),
    installmentFrom: tPrice("installmentFrom"),
    months: tPrice("months"),
    favoriteAdd: t("favoriteAdd"),
    favoriteRemove: t("favoriteRemove"),
    priceOnRequest: t("priceOnRequest"),
    photoPending: tpg("photoPending"),
  };

  const related = (await listCategoryItems(item.category, locale))
    .filter((r) => r.handle !== item.handle)
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-porcelain">
      <ProductJsonLd item={item} locale={locale} />
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1280px] px-4 lg:px-8 pt-4 lg:pt-6 pb-36 lg:pb-8">
        <Breadcrumbs items={crumbs} />

        <div className="mt-4 lg:mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
          {/* Gallery */}
          <div className="-mx-4 lg:mx-0">
            <div className="px-4 lg:px-0">
              <PhotoGallery images={gallery} alt={name} pendingLabel={tpg("photoPending")} />
            </div>
          </div>

          {/* Buy column */}
          <div>
            {collectionName ? (
              <div className="font-mono text-[11px] lg:text-[12px] tracking-[0.1em] uppercase text-brass-text">
                {tpg("collectionEyebrow", { name: collectionName })}
              </div>
            ) : null}
            <h1 className="mt-2 mb-0 font-display text-ink" style={{ fontSize: "clamp(1.5rem, 4vw, 2.1rem)", lineHeight: 1.15 }}>{name}</h1>
            <div className="mt-2 vl-mono text-[12px] lg:text-[13px] text-slate">
              {tpg("specSku")}&nbsp;·&nbsp;{item.sku}
            </div>

            <div className="mt-4 lg:mt-6">
              <PriceTag
                price={price}
                oldPrice={oldPrice}
                wholesalePrice={wholesalePrice}
                wholesaleText={wholesaleText}
                size="lg"
                benefitText={benefitText}
                priceOnRequest={item.priceOnRequest}
                onRequestLabel={t("priceOnRequest")}
              />
            </div>

            {/* Kaspi installment.
                Прячем целиком, когда цены нет: installmentPerMonth(0, 24) даёт 0,
                и блок обещал «0 ₸ / мес» рядом с кнопкой оформления рассрочки.
                Это не ошибка форматирования, а несуществующее предложение —
                для таких товаров канал один, кнопка «Спросить» в WhatsApp,
                у неё для этого своя заготовка (waAskNoPrice). */}
            {!item.priceOnRequest ? (
            <div className={`mt-4 lg:mt-6 p-[18px] lg:p-6 ${CARD}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <KaspiGlyph size={22} />
                <span className="font-sans font-medium text-[15px] lg:text-[16px] text-kaspi tracking-[-0.01em]">{t("kaspiTitle")}</span>
                <span className="font-sans text-[12px] lg:text-[13px] text-slate">
                  <span className="lg:hidden">{t("kaspiSubShort")}</span>
                  <span className="hidden lg:inline">{t("kaspiSub")}</span>
                </span>
              </div>
              <div className="flex items-baseline gap-2.5 lg:gap-3 mt-2.5 lg:mt-3.5 flex-wrap">
                <span className="vl-mono font-medium text-[34px] lg:text-[44px] leading-none text-ink">{formatTenge(perMonth)}</span>
                <span className="vl-mono text-[14px] lg:text-[16px] text-slate">{perMonthUnit}</span>
              </div>
              <div className="mt-3.5 lg:mt-4">
                <KaspiAction label={t("kaspiButton")} phone={HOME_PHONE} message={waInstallment} size="lg" fullWidth />
              </div>
            </div>
            ) : null}

            {/* Stock + delivery */}
            <div className="mt-[18px] lg:mt-[22px] flex flex-col gap-2.5">
              <StockStatus status={item.stock} label={tStock(item.stock)} />
              <div className="flex items-center gap-2.5">
                <Icon name="truck" size={20} color="var(--slate)" />
                <span className="font-sans text-[14px] lg:text-[15px] text-ink">
                  {t("deliveryAlmaty")} — <span className="vl-mono">{t("deliveryDays")}</span>
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 lg:mt-6 flex flex-col gap-3 lg:flex-row">
              <div className="lg:flex-1">
                <AddToCartButton
                  addLabel={t("addToCart")}
                  addedLabel={t("added")}
                  handle={item.handle}
                  size="lg"
                  fullWidth
                  disabled={item.priceOnRequest}
                />
              </div>
              <div className="lg:flex-none">
                <WhatsAppAction label={t("askWhatsApp")} phone={HOME_PHONE} message={waMessage} variant="outline" size="lg" fullWidth />
              </div>
            </div>

            {/* Trust */}
            <div className="mt-6 lg:mt-7 border-t border-[0.5px] border-line pt-5 lg:pt-6 flex flex-col gap-4 lg:gap-[18px]">
              {trust.map((tr, i) => (
                <div key={i} className="flex gap-3.5 items-start">
                  <span className="flex-none inline-flex items-center justify-center w-10 h-10 rounded-md border border-line text-brass">
                    <Icon name={tr.icon as IconName} size={22} color="var(--brass)" />
                  </span>
                  <div>
                    <div className="font-sans font-medium text-[14px] lg:text-[15px] text-ink">{tr.title}</div>
                    <div className="font-sans text-[12px] lg:text-[13px] text-slate mt-0.5 leading-[1.4]">{tr.text}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Key specs */}
            <div className="mt-6 lg:mt-7">
              <h2 className={`${H2} mb-1.5`}>{tpg("specsHeading")}</h2>
              {keySpecs.map((s, i) => (
                <SpecRow key={i} label={s.label} value={s.value} unit={s.unit} last={i === keySpecs.length - 1} />
              ))}
            </div>

            {/* Описание. Секции нет вовсе, пока карточку не заполнили —
                пустой заголовок «Описание» читается как недоделанный сайт. */}
            {detail?.descriptionMd ? (
              <div className="mt-6 lg:mt-7">
                <h2 className={`${H2} mb-2.5`}>{tpg("descriptionHeading")}</h2>
                <ProductDescription markdown={detail.descriptionMd} />
              </div>
            ) : null}
          </div>
        </div>

        {/* Related from the same category */}
        {related.length > 0 ? (
          <div className="mt-10 lg:mt-16">
            <h2 className={`${H2} mb-3.5 lg:mb-5 text-[22px]`}>{tpg("relatedHeading")}</h2>
            <div className="flex gap-4 overflow-x-auto pb-1 vl-noscroll lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible">
              {related.map((r) => {
                const rPct = r.oldPrice ? benefitPercent(r.oldPrice, r.price) : 0;
                return (
                  <div key={r.handle} className="flex-none w-[220px] lg:w-auto">
                    <ProductCard
                      name={r.name}
                      href={`/products/${r.handle}`}
                      handle={r.handle}
                      sku={r.sku}
                      image={r.image}
                      price={r.price}
                      oldPrice={r.oldPrice}
                      wholesalePrice={r.wholesalePrice}
                      priceOnRequest={r.priceOnRequest}
                      status={r.stock}
                      months={r.installmentMonths}
                      labels={{ ...cardLabels, stock: tStock(r.stock), benefit: rPct > 0 ? tPrice("benefit", { pct: rPct }) : undefined }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </main>

      <SiteFooter />
      <MobileTabBar />

      <MobileStickyBar
        price={price}
        addLabel={t("addToCart")}
        addedLabel={t("added")}
        handle={item.handle}
        waPhone={HOME_PHONE}
        waMessage={waMessage}
        waAria={t("askWhatsApp")}
        priceOnRequest={item.priceOnRequest}
        onRequestLabel={t("priceOnRequest")}
      />
    </div>
  );
}
