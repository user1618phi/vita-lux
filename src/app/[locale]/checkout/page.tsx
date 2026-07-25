import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/navigation/SiteHeader";
import { SiteFooter } from "@/components/navigation/SiteFooter";
import { MobileTabBar } from "@/components/navigation/MobileTabBar";
import { CheckoutView } from "@/components/commerce/CheckoutView";

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="min-h-screen bg-porcelain">
      <SiteHeader />
      <main className="pb-20 md:pb-10">
        <CheckoutView />
      </main>
      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}
