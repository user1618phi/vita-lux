import { getTranslations } from "next-intl/server";

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

import { getCategoryItems } from "@/data/catalog";
import { HOME_PHONE } from "@/data/home";
import type { CatalogItem } from "@/lib/catalog";
import { benefitPercent, formatTenge, installmentPerMonth } from "@/lib/format";

type Trust = { title: string; text: string };
type Spec = { label: string; value: string };

const CARD = "bg-glaze border-[0.5px] border-line rounded-lg";
const H2 = "m-0 font-display font-normal text-ink text-[20px] lg:text-[30px]";
const TRUST_ICONS: IconName[] = ["shield-check", "package", "home"];

/* GenericProduct — data-driven product page for every catalog item (real photos,
   price, Kaspi installment, stock, add-to-cart + WhatsApp, spec list from
   structured fields). Fully ru/kk. Monobrand — бренд всегда Vita Lux. */

export async function GenericProduct({ item }: { item: CatalogItem }) {
  const t = await getTranslations("Product");
  const tpg = await getTranslations("ProductGeneric");
  const tCat = await getTranslations("Catalog");
  const tCategories = await getTranslations("Categories");
  const tFilters = await getTranslations("Filters");
  const tStock = await getTranslations("Stock");
  const tPrice = await getTranslations("Price");

  const names = tCat.raw("names") as Record<string, string>;
  const name = names[item.handle] ?? item.handle;
  const collectionName = tFilters(`collections.${item.collection}`);
  const finishName = tFilters(`finishes.${item.finish}`);
  const materialName = item.material ? tFilters(`materials.${item.material}`) : undefined;
  const categoryName = tCategories(`${item.category}.breadcrumb`);

  const { price, oldPrice, installmentMonths: months } = item;
  const pct = oldPrice ? benefitPercent(oldPrice, price) : 0;
  const benefitText = pct > 0 ? tPrice("benefit", { pct }) : undefined;
  const perMonth = installmentPerMonth(price, months);
  const perMonthUnit = t("perMonthUnit", { months });
  const waMessage = `${name} · ${item.sku}`;
  const gallery = item.gallery?.length ? item.gallery : item.image ? [item.image] : [];

  const crumbs = [
    { label: tCat("home"), href: "/" as const },
    { label: categoryName, href: `/catalog/${item.category}` },
    { label: name },
  ];

  const trust = (t.raw("trust") as Trust[]).map((tr, i) => ({ ...tr, icon: TRUST_ICONS[i] }));

  const keySpecs: Spec[] = [
    { label: tpg("specCollection"), value: collectionName },
    { label: tpg("specFinish"), value: finishName },
    ...(materialName ? [{ label: tpg("specMaterial"), value: materialName }] : []),
    ...(item.outletType ? [{ label: tpg("specOutlet"), value: tFilters(`outlet.${item.outletType}`) }] : []),
    ...(item.mountType ? [{ label: tpg("specMount"), value: tFilters(`mount.${item.mountType}`) }] : []),
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
  };

  const related = getCategoryItems(item.category)
    .filter((r) => r.handle !== item.handle)
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-porcelain">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1280px] px-4 lg:px-8 pt-4 lg:pt-6 pb-36 lg:pb-8">
        <Breadcrumbs items={crumbs} />

        <div className="mt-4 lg:mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
          {/* Gallery */}
          <div className="-mx-4 lg:mx-0">
            <div className="px-4 lg:px-0">
              <PhotoGallery images={gallery} alt={name} />
            </div>
          </div>

          {/* Buy column */}
          <div>
            <div className="font-mono text-[11px] lg:text-[12px] tracking-[0.1em] uppercase text-brass-text">
              {tpg("collectionEyebrow", { name: collectionName })}
            </div>
            <h1 className="mt-2 mb-0 font-display text-ink" style={{ fontSize: "clamp(1.5rem, 4vw, 2.1rem)", lineHeight: 1.15 }}>{name}</h1>
            <div className="mt-2 vl-mono text-[12px] lg:text-[13px] text-slate">
              {tpg("specSku")}&nbsp;·&nbsp;{item.sku}
            </div>

            <div className="mt-4 lg:mt-6">
              <PriceTag price={price} oldPrice={oldPrice} size="lg" benefitText={benefitText} />
            </div>

            {/* Kaspi installment */}
            <div className={`mt-4 lg:mt-6 p-[18px] lg:p-6 ${CARD}`}>
              <div className="flex items-center gap-2 flex-wrap">
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
                <KaspiAction label={t("kaspiButton")} phone={HOME_PHONE} message={waMessage} size="lg" fullWidth />
              </div>
            </div>

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
                <AddToCartButton addLabel={t("addToCart")} addedLabel={t("added")} handle={item.handle} size="lg" fullWidth />
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
                <SpecRow key={i} label={s.label} value={s.value} last={i === keySpecs.length - 1} />
              ))}
            </div>
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
                      name={names[r.handle] ?? r.handle}
                      href={`/products/${r.handle}`}
                      handle={r.handle}
                      image={r.image}
                      price={r.price}
                      oldPrice={r.oldPrice}
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
      />
    </div>
  );
}
