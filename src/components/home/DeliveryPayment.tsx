import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/ui/Icon";
import { MediaFrame } from "@/components/ui/MediaFrame";
import { DELIVERY_IMAGE } from "@/data/home";

/* DeliveryPayment — honest delivery/payment block on basalt. Concrete channels
   (Kaspi Red / Halyk ePay / самовывоз), no vague "1–10 days". */

export async function DeliveryPayment() {
  const t = await getTranslations("Home");
  const rows = t.raw("deliveryRows") as string[];

  return (
    <section className="mx-auto w-full max-w-[1280px] px-4 lg:px-8 mt-14 lg:mt-20">
      <div className="grid md:grid-cols-2 gap-6 md:gap-10 items-center rounded-lg bg-basalt p-8 lg:p-12">
        <div>
          <h3 className="m-0 font-display text-[24px] lg:text-[32px] text-porcelain leading-[1.15]">{t("deliveryTitle")}</h3>
          <p className="mt-3 mb-0 font-sans text-[14px] lg:text-[15px] leading-[1.6]" style={{ color: "var(--text-on-dark-muted)" }}>
            {t("deliverySubtitle")}
          </p>
          <ul className="mt-6 m-0 p-0 list-none flex flex-col gap-3">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center gap-3 font-sans text-[14px] lg:text-[15px] text-porcelain">
                <span className="flex-none inline-flex items-center justify-center w-6 h-6 rounded-full" style={{ background: "var(--brass)" }}>
                  <Icon name="check" size={15} color="#fff" strokeWidth={2} />
                </span>
                {r}
              </li>
            ))}
          </ul>
        </div>
        <MediaFrame src={DELIVERY_IMAGE} alt={t("deliveryTitle")} ratio="4 / 3" radius="md" />
      </div>
    </section>
  );
}
