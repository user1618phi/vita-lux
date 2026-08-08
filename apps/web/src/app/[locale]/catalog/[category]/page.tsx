import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SiteHeader } from "@/components/navigation/SiteHeader";
import { SiteFooter } from "@/components/navigation/SiteFooter";
import { MobileTabBar } from "@/components/navigation/MobileTabBar";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ProductCard } from "@/components/ui/ProductCard";
import { Reveal } from "@/components/ui/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/i18n/navigation";

import { FilterControls } from "@/components/catalog/FilterControls";
import { QuickChips } from "@/components/catalog/QuickChips";
import { ActiveChips } from "@/components/catalog/ActiveChips";
import { MobileFilterBar } from "@/components/catalog/MobileFilterBar";
import { SortSelect } from "@/components/catalog/SortSelect";
import { CatalogAnalytics } from "@/components/catalog/CatalogAnalytics";

import { getFilterConfig, listCategories, listCategoryItems } from "@vita/data/repo";
import {
  activeFilterCount,
  clearFiltersHref,
  filterAndSort,
  parseFilters,
  sortHref,
  type RawSearchParams,
  type SortKey,
} from "@vita/core/catalog";
import { benefitPercent, formatTenge } from "@vita/core/format";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}): Promise<Metadata> {
  const { locale, category } = await params;
  const config = await getFilterConfig(category);
  if (!config) return {};

  const t = await getTranslations({ locale, namespace: "Meta" });
  const tCategories = await getTranslations({ locale, namespace: "Categories" });

  /* Canonical СОЗНАТЕЛЬНО не учитывает searchParams.

     Next передаёт их и сюда, и подставить их в адрес — первое, что приходит в
     голову. Делать этого нельзя: каждая комбинация фильтров и сортировок
     (?finish=bronze&sort=price-asc и ещё десятки) — это тот же самый набор
     товаров под другим адресом. Объявив их каноническими, мы бы отдали поиску
     сотни почти одинаковых страниц вместо одной, и они конкурировали бы друг
     с другом. Отфильтрованный вид канонизируется на чистый адрес раздела. */
  return pageMetadata({
    locale,
    path: `/catalog/${category}`,
    title: t("categoryTitle", { title: tCategories(`${category}.title`) }),
    description: tCategories(`${category}.description`),
  });
}

export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const categories = await listCategories();
    return categories.map(({ slug }) => ({ category: slug }));
  } catch {
    // No catalog source reachable at build time — render these routes on demand.
    return [];
  }
}

const SORT_KEYS: SortKey[] = ["popular", "price-asc", "price-desc", "new"];

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; category: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale, category } = await params;
  setRequestLocale(locale);

  const config = await getFilterConfig(category);
  if (!config) notFound();

  const items = await listCategoryItems(category, locale);
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const visible = filterAndSort(items, filters, config);

  const t = await getTranslations("Catalog");
  const tCat = await getTranslations("Categories");
  const tStock = await getTranslations("Stock");
  const tPrice = await getTranslations("Price");

  const title = tCat(`${category}.title`);
  const description = tCat(`${category}.description`);
  const crumbCategory = tCat(`${category}.breadcrumb`);

  const base = `/catalog/${category}`;
  const resultCount = visible.length;
  const activeCount = activeFilterCount(filters);

  const sortOptions = SORT_KEYS.map((v) => ({ value: v, label: t(`sort.${v}`) }));
  const sortHrefs = Object.fromEntries(SORT_KEYS.map((v) => [v, sortHref(base, sp, v)])) as Record<SortKey, string>;

  const tProduct = await getTranslations("Product");
  const tPg = await getTranslations("ProductGeneric");
  const baseLabels = {
    addToCart: tProduct("addToCart"),
    installmentFrom: tPrice("installmentFrom"),
    months: tPrice("months"),
    favoriteAdd: tProduct("favoriteAdd"),
    favoriteRemove: tProduct("favoriteRemove"),
    priceOnRequest: tProduct("priceOnRequest"),
    photoPending: tPg("photoPending"),
  };

  const signature = [
    [...filters.collection].sort().join("+"),
    [...filters.outlet].sort().join("+"),
    [...filters.mount].sort().join("+"),
    [...filters.finish].sort().join("+"),
    filters.price ?? "",
    filters.inStockOnly ? "in" : "",
  ].join("|");

  function labelFor(badge: string | undefined, pct: number) {
    if (badge === "hit") return { kind: "hit" as const, text: t("labelHit") };
    if (badge === "new") return { kind: "new" as const, text: t("labelNew") };
    if (badge === "sale" && pct > 0) return { kind: "sale" as const, text: `−${pct}%` };
    return undefined;
  }

  return (
    <div className="min-h-screen bg-porcelain">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1280px] px-4 lg:px-8 pt-4 lg:pt-6 pb-20 lg:pb-16">
        <Breadcrumbs items={[{ label: t("home"), href: "/" }, { label: crumbCategory }]} />

        {/* Category heading */}
        <div className="mt-3 lg:mt-4 max-w-[720px]">
          <h1 className="m-0 font-display text-ink" style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", lineHeight: 1.15 }}>{title}</h1>
          <p className="mt-2 lg:mt-3 mb-0 font-sans text-[14px] lg:text-[16px] text-slate leading-[1.5]">{description}</p>
        </div>

        <div className="mt-5 lg:mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-10">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <div className="flex items-center justify-between pb-3 border-b-[0.5px] border-line">
                <span className="font-sans font-medium text-[16px] text-ink">{t("filtersButton")}</span>
                {activeCount > 0 ? (
                  <Link href={clearFiltersHref(base, sp)} className="font-sans text-[13px] text-brass-text underline underline-offset-2">
                    {t("reset")}
                  </Link>
                ) : null}
              </div>
              <FilterControls base={base} params={sp} filters={filters} config={config} items={items} />
            </div>
          </aside>

          {/* Content column */}
          <div className="min-w-0">
            {/* Mobile toolbar + quick chips */}
            <div className="lg:hidden flex flex-col gap-3">
              <MobileFilterBar
                filtersLabel={t("filtersButton")}
                activeCount={activeCount}
                sort={{ value: filters.sort, label: t("sortLabel"), hrefs: sortHrefs, options: sortOptions }}
                sheet={{
                  title: t("filtersButton"),
                  closeLabel: t("close"),
                  applyLabel: t("apply", { count: resultCount }),
                  resetLabel: t("reset"),
                  resetHref: clearFiltersHref(base, sp),
                }}
              >
                <FilterControls base={base} params={sp} filters={filters} config={config} items={items} />
              </MobileFilterBar>
              <QuickChips base={base} params={sp} filters={filters} config={config} />
            </div>

            {/* Desktop result row */}
            <div className="hidden lg:flex items-center justify-between mb-4">
              <span className="font-sans text-[14px] text-slate">{t("resultsCount", { count: resultCount })}</span>
              <div className="flex items-center gap-3">
                <span className="font-sans text-[14px] text-slate">{t("sortLabel")}</span>
                <SortSelect value={filters.sort} label={t("sortLabel")} hrefs={sortHrefs} options={sortOptions} />
              </div>
            </div>

            {/* Active filters + mobile count */}
            {activeCount > 0 ? (
              <div className="mt-3 lg:mt-0 lg:mb-4">
                <ActiveChips base={base} params={sp} filters={filters} config={config} />
              </div>
            ) : null}
            <div className="lg:hidden mt-3 font-sans text-[13px] text-slate">
              {t("resultsCount", { count: resultCount })}
            </div>

            {/* Grid or empty */}
            {resultCount > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 lg:gap-6">
                {visible.map((it, i) => {
                  const pct = it.oldPrice ? benefitPercent(it.oldPrice, it.price) : 0;
                  return (
                    <Reveal key={it.handle} delay={Math.min(i, 7) * 40} className="h-full">
                      <ProductCard
                        name={it.name}
                        href={`/products/${it.handle}`}
                        handle={it.handle}
                        sku={it.sku}
                        image={it.image}
                        price={it.price}
                        wholesalePrice={it.wholesalePrice}
                        oldPrice={it.oldPrice}
                        priceOnRequest={it.priceOnRequest}
                        status={it.stock}
                        months={it.installmentMonths}
                        productLabel={labelFor(it.badge, pct)}
                        labels={{
                          ...baseLabels,
                          stock: tStock(it.stock),
                          benefit: pct > 0 ? tPrice("benefit", { pct }) : undefined,
                          wholesaleFrom: it.wholesalePrice
                            ? tPrice("wholesaleFrom", { price: formatTenge(it.wholesalePrice) })
                            : undefined,
                        }}
                      />
                    </Reveal>
                  );
                })}
              </div>
            ) : (
              <div className="mt-2">
                <EmptyState
                  icon="search"
                  title={t("empty")}
                  description={t("emptyDesc")}
                  action={
                    <Link href={clearFiltersHref(base, sp)} className="font-sans text-[14px] text-brass-text underline underline-offset-2">
                      {t("resetAll")}
                    </Link>
                  }
                />
              </div>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
      <MobileTabBar />

      <CatalogAnalytics listId={`${category}:${signature}`} listName={title} itemCount={resultCount} signature={signature} />
    </div>
  );
}
