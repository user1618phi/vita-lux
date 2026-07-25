import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { MediaFrame } from "@/components/ui/MediaFrame";
import { SectionHead } from "./SectionHead";
import { homeCategories } from "@/data/home";

/* CategoryTiles — entry into the catalog. Category names come from the Nav
   catalog (single source). Tiles are photo-ready via MediaFrame; the ones whose
   catalog page isn't built yet carry a «Скоро» chip so links stay honest. */

export async function CategoryTiles() {
  const t = await getTranslations("Home");
  const tn = await getTranslations("Nav");

  return (
    <section className="mx-auto w-full max-w-[1280px] px-4 lg:px-8 mt-14 lg:mt-20">
      <SectionHead
        title={t("categoriesTitle")}
        subtitle={t("categoriesSubtitle")}
        href="/catalog/toilets"
        linkLabel={t("categoriesLink")}
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
        {homeCategories.map((c) => (
          <Link key={c.slug} href={`/catalog/${c.slug}`} className="group block">
            <MediaFrame src={c.image} alt={tn(c.slug)} ratio="3 / 4" fallbackIcon={c.icon} scrim hoverZoom>
              <div className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-between gap-2">
                <span className="font-sans font-medium text-[14px] text-porcelain leading-[1.2]">{tn(c.slug)}</span>
                {!c.live ? (
                  <span className="flex-none font-sans text-[10px] uppercase tracking-[0.08em] text-basalt bg-porcelain/90 rounded-sm px-1.5 py-0.5">
                    {t("soon")}
                  </span>
                ) : null}
              </div>
            </MediaFrame>
          </Link>
        ))}
      </div>
    </section>
  );
}
