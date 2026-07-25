import { getTranslations } from "next-intl/server";
import { Icon, type IconName } from "@/components/ui/Icon";

/* AdvantagesStrip — the brand formula: own production → factory warranty →
   spare parts in stock → Kaspi Red installments. «Сантехника, которую можно
   починить». Order matches messages Home.advantages. */

const ADV_ICONS: IconName[] = ["home", "shield-check", "package", "credit-card"];

export async function AdvantagesStrip() {
  const t = await getTranslations("Home");
  const items = t.raw("advantages") as { title: string; text: string }[];

  return (
    <section className="mx-auto w-full max-w-[1280px] px-4 lg:px-8 mt-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((a, i) => (
          <div key={i} className="flex items-start gap-3 p-4 rounded-lg bg-glaze border-[0.5px] border-line">
            <span className="flex-none inline-flex items-center justify-center w-10 h-10 rounded-md border border-line text-brass">
              <Icon name={ADV_ICONS[i]} size={22} color="var(--brass)" />
            </span>
            <div>
              <p className="m-0 font-sans font-medium text-[14px] text-ink leading-[1.3]">{a.title}</p>
              <p className="mt-1 mb-0 font-sans text-[12px] lg:text-[13px] text-slate leading-[1.4]">{a.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
