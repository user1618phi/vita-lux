import { getLocale, getTranslations } from "next-intl/server";
import { ProductCard } from "@/components/ui/ProductCard";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHead } from "./SectionHead";
import { getHomeHits } from "@vita/data/repo";
import { benefitPercent, formatTenge } from "@vita/core/format";

/* HitsRow — top models, reusing the exact catalog ProductCard (same labels,
   badges, stock states). Names arrive already localized from the repository. */

function labelFor(badge: string | undefined, pct: number, hit: string, isNew: string) {
  if (badge === "hit") return { kind: "hit" as const, text: hit };
  if (badge === "new") return { kind: "new" as const, text: isNew };
  if (badge === "sale" && pct > 0) return { kind: "sale" as const, text: `−${pct}%` };
  return undefined;
}

export async function HitsRow() {
  const t = await getTranslations("Home");
  const tCat = await getTranslations("Catalog");
  const tStock = await getTranslations("Stock");
  const tPrice = await getTranslations("Price");
  const tProduct = await getTranslations("Product");

  const hits = await getHomeHits(await getLocale(), 8);
  const labelHit = tCat("labelHit");
  const labelNew = tCat("labelNew");

  const baseLabels = {
    addToCart: tProduct("addToCart"),
    installmentFrom: tPrice("installmentFrom"),
    months: tPrice("months"),
    favoriteAdd: tProduct("favoriteAdd"),
    favoriteRemove: tProduct("favoriteRemove"),
  };

  return (
    <section className="mx-auto w-full max-w-[1280px] px-4 lg:px-8 mt-14 lg:mt-20">
      <SectionHead title={t("hitsTitle")} subtitle={t("hitsSubtitle")} href="/catalog/toilets" linkLabel={t("hitsLink")} />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {hits.map((it, i) => {
          const pct = it.oldPrice ? benefitPercent(it.oldPrice, it.price) : 0;
          return (
            <Reveal key={it.handle} delay={Math.min(i, 7) * 40} className="h-full">
              <ProductCard
                name={it.name}
                href={`/products/${it.handle}`}
                handle={it.handle}
                image={it.image}
                price={it.price}
                wholesalePrice={it.wholesalePrice}
                oldPrice={it.oldPrice}
                status={it.stock}
                months={it.installmentMonths}
                productLabel={labelFor(it.badge, pct, labelHit, labelNew)}
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
    </section>
  );
}
