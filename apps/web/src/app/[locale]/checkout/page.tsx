import { setRequestLocale } from "next-intl/server";
import { getSettings } from "@vita/data/settings";
import { SiteHeader } from "@/components/navigation/SiteHeader";
import { SiteFooter } from "@/components/navigation/SiteFooter";
import { MobileTabBar } from "@/components/navigation/MobileTabBar";
import { CheckoutView } from "@/components/commerce/CheckoutView";

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Delivery thresholds are editable in the admin, not compiled in.
  const settings = await getSettings();

  return (
    <div className="min-h-screen bg-porcelain">
      <SiteHeader />
      <main className="pb-20 md:pb-10">
        <CheckoutView freeFrom={settings.freeFromKzt} deliveryCostKzt={settings.deliveryCostKzt} />
      </main>
      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}
