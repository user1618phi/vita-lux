import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/navigation/SiteHeader";
import { SiteFooter } from "@/components/navigation/SiteFooter";
import { MobileTabBar } from "@/components/navigation/MobileTabBar";
import { FavoritesView } from "@/components/commerce/FavoritesView";

export default async function FavoritesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="min-h-screen bg-porcelain">
      <SiteHeader />
      <main className="pb-20 md:pb-10">
        <FavoritesView />
      </main>
      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}
