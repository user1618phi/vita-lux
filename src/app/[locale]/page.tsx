import { setRequestLocale } from "next-intl/server";

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

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

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
    </div>
  );
}
