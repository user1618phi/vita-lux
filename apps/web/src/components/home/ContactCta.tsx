import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { WhatsAppAction } from "@/components/product/ChannelActions";
import { HOME_PHONE } from "@vita/data/content/home";
import { SITE_DOMAIN } from "@vita/core/site";

/* ContactCta — closing help block. WhatsApp is the primary channel (attribution
   surface); phone is the fallback. */

export async function ContactCta() {
  const t = await getTranslations("Home");

  return (
    <section className="mx-auto w-full max-w-[1280px] px-4 lg:px-8 mt-14 lg:mt-20">
      <div className="rounded-lg border-[0.5px] border-line bg-glaze p-10 lg:p-14 text-center">
        <h3 className="m-0 font-display text-[26px] lg:text-[36px] text-ink leading-[1.15]">{t("contactTitle")}</h3>
        <p className="mt-3 mb-0 mx-auto max-w-[52ch] font-sans text-[14px] lg:text-[15px] text-slate leading-[1.6]">
          {t("contactSubtitle")}
        </p>
        <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
          <div className="w-full sm:w-auto" data-wa-cta>
            <WhatsAppAction label={t("contactWhatsApp")} phone={HOME_PHONE} message={t("waMessage", { site: SITE_DOMAIN })} variant="solid" size="lg" fullWidth />
          </div>
          <div className="w-full sm:w-auto">
            <a href={`tel:+${HOME_PHONE}`} className="block">
              <Button variant="secondary" size="lg" fullWidth iconLeft={<Icon name="phone" size={20} />}>
                {t("contactCall")}
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
