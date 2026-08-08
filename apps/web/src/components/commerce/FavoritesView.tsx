"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ProductCard } from "@/components/ui/ProductCard";
import { Reveal } from "@/components/ui/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCart } from "@/context/CartContext";
import { benefitPercent, formatTenge } from "@vita/core/format";

function labelFor(badge: string | undefined, pct: number, hit: string, isNew: string) {
  if (badge === "hit") return { kind: "hit" as const, text: hit };
  if (badge === "new") return { kind: "new" as const, text: isNew };
  if (badge === "sale" && pct > 0) return { kind: "sale" as const, text: `−${pct}%` };
  return undefined;
}

export function FavoritesView() {
  const t = useTranslations("Favorites");
  const tCat = useTranslations("Catalog");
  const tStock = useTranslations("Stock");
  const tPrice = useTranslations("Price");
  const tProduct = useTranslations("Product");
  const tPg = useTranslations("ProductGeneric");
  // Resolved server-side by the cart context — the browser never joins against
  // the catalog itself.
  const { favoriteItems: items, hydrated } = useCart();

  const baseLabels = {
    addToCart: tProduct("addToCart"),
    installmentFrom: tPrice("installmentFrom"),
    months: tPrice("months"),
    favoriteAdd: tProduct("favoriteAdd"),
    favoriteRemove: tProduct("favoriteRemove"),
    priceOnRequest: tProduct("priceOnRequest"),
    photoPending: tPg("photoPending"),
  };

  if (!hydrated) return <div style={{ minHeight: "50vh" }} />;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 lg:px-8">
        <EmptyState
          icon="heart"
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          action={
            <Link href="/catalog/toilets" className="inline-block">
              <Button variant="primary" size="lg" iconRight={<Icon name="arrow-right" size={20} />}>
                {t("toCatalog")}
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 lg:px-8 py-6 lg:py-10">
      <h1 className="m-0 mb-6 font-display text-ink" style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", lineHeight: 1.15 }}>{t("title")}</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {items.map((it, i) => {
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
                productLabel={labelFor(it.badge, pct, tCat("labelHit"), tCat("labelNew"))}
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
    </div>
  );
}
