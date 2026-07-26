import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/navigation/SiteHeader";
import { SiteFooter } from "@/components/navigation/SiteFooter";
import { MobileTabBar } from "@/components/navigation/MobileTabBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Link } from "@/i18n/navigation";

/* A discontinued product is a normal event in this catalog, so a 404 should
   read like a shop assistant, not a stack trace. */

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <div className="min-h-screen bg-porcelain">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1280px] px-4 lg:px-8 py-16 pb-24">
        <EmptyState
          icon="search"
          title={t("title")}
          description={t("desc")}
          action={
            <Link href="/catalog/toilets" className="inline-block">
              <Button variant="primary" size="lg" iconRight={<Icon name="arrow-right" size={20} />}>
                {t("cta")}
              </Button>
            </Link>
          }
        />
      </main>
      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}
