import { getTranslations, setRequestLocale } from "next-intl/server";

import { SiteHeader } from "@/components/navigation/SiteHeader";
import { SiteFooter } from "@/components/navigation/SiteFooter";
import { MobileTabBar } from "@/components/navigation/MobileTabBar";

import { Hero } from "@/components/home/Hero";
import { AdvantagesStrip } from "@/components/home/AdvantagesStrip";
import { CategoryTiles } from "@/components/home/CategoryTiles";
import { CollectionStrip } from "@/components/home/CollectionStrip";
import { HitsRow } from "@/components/home/HitsRow";
import { DeliveryPayment } from "@/components/home/DeliveryPayment";
import { ContactCta } from "@/components/home/ContactCta";
import { WhatsAppFab } from "@/components/home/WhatsAppFab";
import { HOME_PHONE } from "@vita/data/content/home";
import { SITE_DOMAIN } from "@vita/core/site";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  return (
    <div className="min-h-screen bg-porcelain">
      <SiteHeader />

      <main className="pb-20 md:pb-4">
        <Hero />
        <AdvantagesStrip />
        <CategoryTiles />
        <CollectionStrip />
        <HitsRow />
        <DeliveryPayment />
        <ContactCta />
      </main>

      <SiteFooter />
      <MobileTabBar />
      {/* Держит канал под рукой на всём пути между двумя кнопками WhatsApp. */}
      <WhatsAppFab
        phone={HOME_PHONE}
        message={t("waMessage", { site: SITE_DOMAIN })}
        label={t("contactWhatsApp")}
      />
    </div>
  );
}
