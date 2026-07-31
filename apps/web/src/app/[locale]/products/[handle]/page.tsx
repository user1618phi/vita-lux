import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SiteHeader } from "@/components/navigation/SiteHeader";
import { SiteFooter } from "@/components/navigation/SiteFooter";
import { MobileTabBar } from "@/components/navigation/MobileTabBar";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PriceTag } from "@/components/ui/PriceTag";
import { StockStatus } from "@/components/ui/StockStatus";
import { SpecRow } from "@/components/ui/SpecRow";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DimensionLine } from "@/components/ui/DimensionLine";
import { ProductLabel } from "@/components/ui/ProductLabel";
import { ProductCard } from "@/components/ui/ProductCard";
import { Icon, type IconName } from "@/components/ui/Icon";

import { PhotoGallery } from "@/components/product/PhotoGallery";
import { AddToCartButton } from "@/components/product/AddToCartButton";
import { KaspiAction, WhatsAppAction } from "@/components/product/ChannelActions";
import { MobileStickyBar } from "@/components/product/MobileStickyBar";
import { MountingScheme } from "@/components/product/MountingScheme";

import { getProduct } from "@vita/data/content/products";
import { getItem, listCategoryItems, listHandles } from "@vita/data/repo";
import { getSettings } from "@vita/data/settings";
import { GenericProduct } from "@/components/product/GenericProduct";
import { ProductJsonLd } from "@/components/seo/ProductJsonLd";
import { KaspiGlyph } from "@/components/ui/KaspiGlyph";
import { benefitPercent, formatTenge, formatTengePlain, groupDigits, installmentPerMonth } from "@vita/core/format";
import { SITE_DOMAIN } from "@vita/core/site";

type Spec = { label: string; value: string; unit?: string };
type Trust = { title: string; text: string };
type Row = { label: string; value: string };

const CARD = "bg-glaze border-[0.5px] border-line rounded-lg";
const H2 = "m-0 font-display font-normal text-ink text-[20px] lg:text-[30px]";

export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    return (await listHandles()).map((handle) => ({ handle }));
  } catch {
    // No catalog source reachable at build time — render these routes on demand.
    return [];
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; handle: string }>;
}) {
  const { locale, handle } = await params;
  setRequestLocale(locale);

  const item = await getItem(handle, locale);
  if (!item) notFound();

  // Only aura-540 has the fully bespoke rich page; every other catalog item
  // renders through the data-driven GenericProduct.
  const product = getProduct(handle);
  if (!product) {
    return <GenericProduct item={item} />;
  }

  const t = await getTranslations("Product");
  const tStock = await getTranslations("Stock");
  const tPrice = await getTranslations("Price");

  /* Anything a manager can change — price, stock, name — comes from the
     catalog, never from the static module. `products.ts` keeps only the
     editorial extras this one page adds: the bundle, the dimensions and the
     mounting scheme. Reading the price from there meant an admin edit updated
     the catalog card but not the product page. */
  const settings = await getSettings();
  const { price, oldPrice, installmentMonths: months } = item;
  const phone = settings.phonePrimary;
  const pct = oldPrice ? benefitPercent(oldPrice, price) : 0;
  const perMonth = installmentPerMonth(price, months);
  const benefitText = pct > 0 ? tPrice("benefit", { pct }) : undefined;
  const perMonthUnit = t("perMonthUnit", { months });
  const stockLabel = tStock(item.stock);
  const productName = item.name;

  /* Заготовки для WhatsApp. Раньше в поле уезжало «Aura 540 · VL-A540-W» —
     без приветствия и без вопроса: менеджер не знал, чего от него хотят, а
     покупатель дописывал сообщение сам. Теперь у каждой кнопки свой текст:
     «Спросить» — про наличие и сроки, «Рассрочка» — про рассрочку. */
  const waParams = {
    site: SITE_DOMAIN,
    name: productName,
    sku: item.sku,
    price: formatTengePlain(price),
  };
  const waMessage = item.priceOnRequest ? t("waAskNoPrice", waParams) : t("waAsk", waParams);
  const waInstallment = t("waInstallment", { ...waParams, months });

  // Localized structured content (zipped with numeric data by index).
  const crumbLabels = t.raw("breadcrumbs") as string[];
  const crumbs = crumbLabels.map((label, i) => ({
    label,
    href: i < crumbLabels.length - 1 ? "/" : undefined,
  }));
  const trust = (t.raw("trust") as Trust[]).map((tr, i) => ({ ...tr, icon: product.trustIcons[i] }));
  const keySpecs = t.raw("keySpecs") as Spec[];
  const fullSpecs = t.raw("fullSpecs") as Spec[];
  const included = t.raw("included") as string[];
  const excluded = t.raw("excluded") as string[];
  const bundleNames = t.raw("bundleItems") as string[];
  const deliveryRows = t.raw("deliveryRows") as Row[];
  const paymentRows = t.raw("paymentRows") as Row[];
  /* The set is priced off the live product price, not the static one, so the
     arithmetic still adds up after an admin changes it. Only the accessories
     keep their editorial prices until they become real catalog items. */
  const bundlePrices = product.bundle.itemPrices.map((p, i) => (i === 0 ? price : p));
  const bundleSum = bundlePrices.reduce((a, b) => a + b, 0);
  const bundleSave = Math.max(0, Math.round((bundleSum * product.bundle.save) / product.bundle.sum / 100) * 100);
  const bundleSet = bundleSum - bundleSave;
  const bundle = bundleNames.map((name, i) => ({ name, priceStr: groupDigits(bundlePrices[i]) }));

  // Real catalog items from the same collection. Previously this was a
  // hand-written list zipped by index with a `Product.related` message array —
  // it pointed at four handles that do not exist, so every card 404'd.
  const related = (await listCategoryItems(item.category, locale))
    .filter((r) => r.handle !== handle && r.collection === item.collection)
    .slice(0, 4);

  const cardLabels = {
    stock: tStock("in"),
    addToCart: t("addToCart"),
    installmentFrom: tPrice("installmentFrom"),
    months: tPrice("months"),
    favoriteAdd: t("favoriteAdd"),
    favoriteRemove: t("favoriteRemove"),
  };

  return (
    <div className="min-h-screen bg-porcelain">
      <ProductJsonLd item={item} locale={locale} />
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1280px] px-4 lg:px-8 pt-4 lg:pt-6 pb-36 lg:pb-2">
        <Breadcrumbs items={crumbs} />

        {/* ── GALLERY + BUY ─────────────────────────────────────────── */}
        <div className="mt-4 lg:mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:gap-14">
          {/* Gallery */}
          <div className="-mx-4 lg:mx-0">
            <div className="px-4 lg:px-0">
              <PhotoGallery images={item.gallery?.length ? item.gallery : item.image ? [item.image] : []} alt={productName} />
            </div>
          </div>

          {/* Buy column */}
          <div>
            <div className="font-mono text-[11px] lg:text-[12px] tracking-[0.1em] uppercase text-brass-text">
              {t("eyebrow")}
            </div>
            <h1 className="mt-2 mb-0 font-display text-ink" style={{ fontSize: "clamp(1.5rem, 4vw, 2.1rem)", lineHeight: 1.15 }}>
              {productName}
            </h1>
            <div className="mt-2 vl-mono text-[12px] lg:text-[13px] text-slate">
              {t("skuLabel")}&nbsp;·&nbsp;{item.sku}
            </div>

            {/* Price */}
            <div className="mt-4 lg:mt-6">
              <PriceTag price={price} oldPrice={oldPrice} size="lg" benefitText={benefitText} />
            </div>

            {/* Kaspi installment — conversion trigger */}
            <div className={`mt-4 lg:mt-6 p-[18px] lg:p-6 ${CARD}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <KaspiGlyph size={22} />
                <span className="font-sans font-medium text-[15px] lg:text-[16px] text-kaspi tracking-[-0.01em]">
                  {t("kaspiTitle")}
                </span>
                <span className="font-sans text-[12px] lg:text-[13px] text-slate">
                  <span className="lg:hidden">{t("kaspiSubShort")}</span>
                  <span className="hidden lg:inline">{t("kaspiSub")}</span>
                </span>
              </div>
              <div className="flex items-baseline gap-2.5 lg:gap-3 mt-2.5 lg:mt-3.5 flex-wrap">
                <span className="vl-mono font-medium text-[34px] lg:text-[44px] leading-none text-ink">
                  {formatTenge(perMonth)}
                </span>
                <span className="vl-mono text-[14px] lg:text-[16px] text-slate">{perMonthUnit}</span>
              </div>
              <div className="mt-3.5 lg:mt-4">
                <KaspiAction label={t("kaspiButton")} phone={phone} message={waInstallment} size="lg" fullWidth />
              </div>
            </div>

            {/* Stock + delivery */}
            <div className="mt-[18px] lg:mt-[22px] flex flex-col gap-2.5">
              <StockStatus status={item.stock} label={stockLabel} />
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
                <AddToCartButton addLabel={t("addToCart")} addedLabel={t("added")} handle={handle} size="lg" fullWidth />
              </div>
              <div className="lg:flex-none">
                <WhatsAppAction label={t("askWhatsApp")} phone={phone} message={waMessage} variant="outline" size="lg" fullWidth />
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
              <h2 className={`${H2} mb-1.5`}>{t("keySpecsHeading")}</h2>
              {keySpecs.map((s, i) => (
                <SpecRow key={i} label={s.label} value={s.value} unit={s.unit} last={i === keySpecs.length - 1} />
              ))}
            </div>
          </div>
        </div>

        {/* Signature divider */}
        <div className="my-8 lg:my-14">
          <DimensionLine labelBg="var(--surface-media)" />
        </div>

        {/* Included / excluded */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={`${CARD} p-5 lg:p-7`}>
            <h3 className="m-0 mb-3.5 font-sans font-medium text-[15px] lg:text-[16px] text-ink">{t("includedHeading")}</h3>
            {included.map((row, i) => (
              <div key={i} className="flex gap-3 items-center py-2 lg:py-2.5 border-b border-[0.5px] border-line">
                <Icon name="check" size={20} color="var(--brass)" />
                <span className="font-sans text-[14px] lg:text-[15px] text-ink">{row}</span>
              </div>
            ))}
          </div>
          <div className={`${CARD} p-5 lg:p-7`}>
            <h3 className="m-0 mb-3.5 font-sans font-medium text-[15px] lg:text-[16px] text-slate">{t("excludedHeading")}</h3>
            {excluded.map((row, i) => (
              <div key={i} className="flex gap-3 items-center py-2 lg:py-2.5 border-b border-[0.5px] border-line">
                <Icon name="x" size={20} color="var(--slate)" />
                <span className="font-sans text-[14px] lg:text-[15px] text-slate">{row}</span>
              </div>
            ))}
            <p className="mt-4 mb-0 font-sans text-[13px] text-slate leading-[1.5]">{t("excludedNote")}</p>
          </div>
        </div>

        {/* Bundle */}
        <div className="mt-8 lg:mt-14">
          <h2 className={`${H2} mb-3.5 lg:mb-5 text-[22px]`}>{t("bundleHeading")}</h2>
          <div className={`${CARD} p-5 lg:p-7 flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-6`}>
            <div className="vl-noscroll flex items-start lg:items-center gap-3 lg:gap-5 flex-1 min-w-0 overflow-x-auto">
              {bundle.map((b, i) => (
                <div key={i} className="flex items-center gap-3 lg:gap-5">
                  <div className="text-center flex-none w-24">
                    <div className="w-24 h-[118px] lg:h-[120px] rounded-md bg-porcelain flex items-center justify-center text-border-strong">
                      <Icon name="package" size={34} strokeWidth={1} />
                    </div>
                    <div className="mt-2 font-sans text-[11px] lg:text-[12px] text-ink leading-[1.3]">{b.name}</div>
                    <div className="mt-0.5 vl-mono text-[11px] lg:text-[12px] text-slate">{b.priceStr}&nbsp;₸</div>
                  </div>
                  {/* Связка между позициями набора — графика, не текст. */}
                  {i < bundle.length - 1 ? <span aria-hidden="true" className="vl-mono text-[22px] text-border-strong">+</span> : null}
                </div>
              ))}
            </div>
            <div className="flex-none lg:min-w-[220px] pt-4 lg:pt-0 lg:pl-6 border-t border-[0.5px] lg:border-t-0 lg:border-l border-line">
              <div className="font-sans text-[12px] lg:text-[13px] text-slate">
                <span className="lg:hidden">{t("bundlePriceSeparatelyShort")}</span>
                <span className="hidden lg:inline">{t("bundlePriceSeparately")}</span>{" "}
                <span className="vl-mono line-through">{groupDigits(bundleSum)}&nbsp;₸</span>
              </div>
              <div className="mt-1.5 vl-mono font-medium text-[24px] lg:text-[30px] text-ink leading-none">
                {groupDigits(bundleSet)}&nbsp;₸
              </div>
              <div className="mt-1.5">
                <Badge variant="success">
                  <span className="lg:hidden">{t("bundleBenefitShort", { amount: groupDigits(bundleSave) })}</span>
                  <span className="hidden lg:inline">{t("bundleBenefit", { amount: groupDigits(bundleSave) })}</span>
                </Badge>
              </div>
              <div className="mt-3 lg:mt-4">
                <AddToCartButton addLabel={t("bundleBuy")} addedLabel={t("added")} size="md" iconSize={20} fullWidth />
              </div>
            </div>
          </div>
        </div>

        {/* Full specs */}
        <div className="mt-8 lg:mt-14">
          <h2 className={`${H2} mb-3.5 lg:mb-5 text-[22px]`}>{t("fullSpecsHeading")}</h2>
          <div className={`${CARD} px-5 lg:px-7 py-1.5 lg:[column-count:2] lg:[column-gap:56px]`}>
            {fullSpecs.map((s, i) => (
              <div key={i} className="break-inside-avoid">
                <SpecRow label={s.label} value={s.value} unit={s.unit} />
              </div>
            ))}
          </div>
        </div>

        {/* Mounting scheme */}
        <div className="mt-8 lg:mt-14">
          <h2 className={`${H2} mb-3.5 lg:mb-5 text-[22px]`}>{t("mountingHeading")}</h2>
          <div className={`${CARD} p-5 lg:p-8`}>
            <MountingScheme
              widthLabel={product.dims.width}
              heightLabel={product.dims.height}
              frontLabel={product.dims.front}
              frontDescription={t("mountingWidthFrontShort")}
            />
            <p className="mt-4 lg:mt-5 mb-0 mx-auto max-w-[520px] font-sans text-[13px] lg:text-[14px] text-slate leading-[1.6] lg:text-center">
              <span className="lg:hidden">{t("mountingCaptionShort")}</span>
              <span className="hidden lg:inline">{t("mountingCaption")}</span>
            </p>
          </div>
        </div>

        {/* Reviews (empty) */}
        <div className="mt-8 lg:mt-14">
          <h2 className={`${H2} mb-3.5 lg:mb-5 text-[22px]`}>{t("reviewsHeading")}</h2>
          <div className={`${CARD} p-3 lg:p-7`}>
            <EmptyState icon="info" title={t("reviewsEmptyTitle")} description={t("reviewsEmptyDesc")} />
          </div>
        </div>

        {/* Delivery & payment */}
        <div className="mt-8 lg:mt-14">
          <h2 className={`${H2} mb-3.5 lg:mb-5 text-[22px]`}>{t("deliveryPaymentHeading")}</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className={`${CARD} px-5 lg:px-7 py-1.5 lg:py-3`}>
              <div className="flex items-center gap-2.5 pt-4 pb-2 text-brass">
                <Icon name="truck" size={20} color="var(--brass)" />
                <span className="font-sans font-medium text-[14px] lg:text-[15px] text-ink">{t("deliveryColHeading")}</span>
              </div>
              {deliveryRows.map((r, i) => (
                <SpecRow key={i} label={r.label} value={r.value} last={i === deliveryRows.length - 1} />
              ))}
            </div>
            <div className={`${CARD} px-5 lg:px-7 py-1.5 lg:py-3`}>
              <div className="flex items-center gap-2.5 pt-4 pb-2 text-brass">
                <Icon name="credit-card" size={20} color="var(--brass)" />
                <span className="font-sans font-medium text-[14px] lg:text-[15px] text-ink">{t("paymentColHeading")}</span>
              </div>
              {paymentRows.map((r, i) => (
                <SpecRow key={i} label={r.label} value={r.value} last={i === paymentRows.length - 1} />
              ))}
            </div>
          </div>
        </div>

        {/* From collection */}
        <div className="mt-8 lg:mt-14 mb-2">
          <h2 className={`${H2} mb-3.5 lg:mb-5 text-[22px]`}>{t("relatedHeading")}</h2>
          <div className="flex gap-4 overflow-x-auto pb-1 vl-noscroll lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible">
            {related.map((r) => {
              const rPct = r.oldPrice ? benefitPercent(r.oldPrice, r.price) : 0;
              return (
                <div key={r.handle} className="flex-none w-[220px] lg:w-auto">
                  <ProductCard
                    name={r.name}
                    href={`/products/${r.handle}`}
                    handle={r.handle}
                    image={r.image}
                    price={r.price}
                    oldPrice={r.oldPrice}
                    status={r.stock}
                    months={r.installmentMonths}
                    labels={{
                      ...cardLabels,
                      stock: tStock(r.stock),
                      benefit: rPct > 0 ? tPrice("benefit", { pct: rPct }) : undefined,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <SiteFooter />
      <MobileTabBar />

      {/* Mobile sticky buy bar */}
      <MobileStickyBar
        price={price}
        addLabel={t("addToCart")}
        addedLabel={t("added")}
        handle={handle}
        waPhone={phone}
        waMessage={waMessage}
        waAria={t("askWhatsApp")}
      />
    </div>
  );
}
