import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { MediaFrame } from "@/components/ui/MediaFrame";
import { SectionHead } from "./SectionHead";
import { homeCollections } from "@vita/data/content/home";

/* CollectionStrip — editorial collections (Aura / Standart / Bronze). A Vita
   Lux brand device the generic reseller design lacks. Each card links into the
   catalog pre-filtered by collection (a link that already works today). */

export async function CollectionStrip() {
  const t = await getTranslations("Home");

  return (
    <section className="mx-auto w-full max-w-[1280px] px-4 lg:px-8 mt-14 lg:mt-20">
      <SectionHead title={t("collectionsTitle")} subtitle={t("collectionsSubtitle")} />
      <div className="grid gap-4 md:grid-cols-3">
        {homeCollections.map((c) => {
          const slug = c.slug;
          const name = t(`collections.${slug}.name`);
          const blurb = t(`collections.${slug}.blurb`);
          return (
            <Link
              key={slug}
              href={`/catalog/toilets?collection=${slug}`}
              className="group flex flex-col rounded-lg border-[0.5px] border-line bg-glaze overflow-hidden"
            >
              <MediaFrame src={c.image} alt={name} ratio="16 / 10" radius="none" hoverZoom />
              <div className="p-5">
                <div className="font-display text-[22px] text-ink leading-none">{name}</div>
                <p className="mt-2 mb-0 font-sans text-[13px] lg:text-[14px] text-slate leading-[1.5]">{blurb}</p>
                <span aria-hidden="true" className="mt-3 inline-flex items-center gap-1.5 font-sans text-[13px] text-brass-text">
                  Vita Lux
                  <Icon name="arrow-right" size={16} color="var(--brass)" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
