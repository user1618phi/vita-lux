import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { eq } from "drizzle-orm";
import { db, hasDatabase, schema } from "@vita/db/client";
import { SiteHeader } from "@/components/navigation/SiteHeader";
import { SiteFooter } from "@/components/navigation/SiteFooter";
import { MobileTabBar } from "@/components/navigation/MobileTabBar";
import { Icon } from "@/components/ui/Icon";
import { WhatsAppAction } from "@/components/product/ChannelActions";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { groupDigits } from "@vita/core/format";
import { SITE_DOMAIN } from "@vita/core/site";
import { getSettings } from "@vita/data/settings";
import { normalizeRefCode } from "@vita/core/order/ref";

/* A real URL for a placed order, replacing the in-component success state.

   Two things this buys: the customer can reopen or forward the page, and the
   manager can say "пришлите номер заказа" and get something that resolves.
   Never indexed — it is a private receipt. */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ locale: string; ref: string }>;
}) {
  const { locale, ref } = await params;
  setRequestLocale(locale);

  const refCode = normalizeRefCode(ref);
  if (!refCode || !hasDatabase()) notFound();

  const [order] = await db()
    .select({
      refCode: schema.order.refCode,
      totalKzt: schema.order.totalKzt,
      subtotalKzt: schema.order.subtotalKzt,
      deliveryKzt: schema.order.deliveryKzt,
      createdAt: schema.order.createdAt,
    })
    .from(schema.order)
    .where(eq(schema.order.refCode, refCode))
    .limit(1);

  if (!order) notFound();

  const lines = await db()
    .select({
      name: schema.orderItem.nameSnapshot,
      qty: schema.orderItem.qty,
      lineTotalKzt: schema.orderItem.lineTotalKzt,
    })
    .from(schema.orderItem)
    .innerJoin(schema.order, eq(schema.order.id, schema.orderItem.orderId))
    .where(eq(schema.order.refCode, refCode));

  const t = await getTranslations("Checkout");
  const tCart = await getTranslations("Cart");
  const settings = await getSettings();

  const waMessage = t("waConfirm", { site: SITE_DOMAIN, order: order.refCode, total: groupDigits(order.totalKzt) });

  return (
    <div className="min-h-screen bg-porcelain">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[640px] px-4 lg:px-8 py-10 lg:py-16 pb-24">
        <div className="text-center">
          <div
            className="grid place-items-center mx-auto mb-5 rounded-full"
            style={{ width: 80, height: 80, background: "var(--beige)" }}
          >
            <Icon name="check" size={40} color="var(--brass)" strokeWidth={2} />
          </div>
          <h1 className="m-0 font-display font-normal text-[28px] text-ink">{t("successTitle")}</h1>
          <p className="mt-3 mb-0 mx-auto max-w-[40ch] font-sans text-[15px] text-slate leading-[1.6]">
            {t("successDesc", { order: order.refCode })}
          </p>
        </div>

        {/* The order already exists in the database, so if the customer never
            sends this message we lose a conversation, not a sale. */}
        <div className="mt-7">
          <WhatsAppAction
            label={t("waConfirmButton")}
            phone={settings.phonePrimary}
            message={waMessage}
            variant="solid"
            size="lg"
            fullWidth
          />
        </div>

        <div className="mt-8 rounded-lg border-[0.5px] border-line bg-glaze p-5">
          <h2 className="m-0 mb-3 font-sans font-medium text-[16px] text-ink">{t("yourOrder")}</h2>
          <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
            {lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-3 font-sans text-[14px]">
                <span className="text-ink">
                  {l.name} <span className="vl-mono text-slate">× {l.qty}</span>
                </span>
                <span className="vl-mono text-ink whitespace-nowrap">{groupDigits(l.lineTotalKzt)} ₸</span>
              </li>
            ))}
          </ul>

          <div className="border-t border-[0.5px] border-line mt-4 pt-4 flex flex-col gap-2.5 font-sans text-[14px]">
            <div className="flex justify-between">
              <span className="text-slate">{t("goods")}</span>
              <span className="vl-mono text-ink">{groupDigits(order.subtotalKzt)} ₸</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate">{t("delivery")}</span>
              <span className="vl-mono text-ink">
                {order.deliveryKzt === 0 ? t("free") : `${groupDigits(order.deliveryKzt)} ₸`}
              </span>
            </div>
            <div className="flex justify-between border-t border-[0.5px] border-line pt-3">
              <span className="font-medium text-ink">{t("total")}</span>
              <span className="vl-mono font-medium text-[22px] text-ink">{groupDigits(order.totalKzt)} ₸</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="inline-block">
            <Button variant="secondary" size="lg">{t("toHome")}</Button>
          </Link>
          <Link href="/catalog/toilets" className="inline-block">
            <Button variant="secondary" size="lg">{tCart("toCatalog")}</Button>
          </Link>
        </div>
      </main>

      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}
