"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCart } from "@/context/CartContext";
import { groupDigits } from "@vita/core/format";
import { track } from "@vita/core/analytics";

/* Defaults only — the page passes the values stored in `setting`. */
const FREE_FROM = 150000;
const DELIVERY_COST = 3900;

const tenge = (n: number) => `${groupDigits(n)} ₸`;

export function CartView({
  freeFrom = FREE_FROM,
  deliveryCostKzt = DELIVERY_COST,
}: {
  freeFrom?: number;
  deliveryCostKzt?: number;
} = {}) {
  const t = useTranslations("Cart");
  const tStock = useTranslations("Stock");
  const tProduct = useTranslations("Product");
  const { detailed, setQty, remove, subtotal, hydrated, unavailable, dismissUnavailable } = useCart();
  const fired = useRef(false);

  useEffect(() => {
    if (hydrated && detailed.length && !fired.current) {
      fired.current = true;
      track("view_cart", { value: subtotal, item_count: detailed.length });
    }
  }, [hydrated, detailed.length, subtotal]);

  if (!hydrated) return <div style={{ minHeight: "50vh" }} />;

  if (detailed.length === 0) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 lg:px-8">
        <EmptyState
          icon="shopping-bag"
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          action={
            <Link href="/catalog/toilets" className="inline-block">
              <Button variant="primary" size="lg" iconRight={<Icon name="arrow-right" size={20} />}>
                {t("toCatalog")}
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const delivery = subtotal >= freeFrom ? 0 : deliveryCostKzt;
  const total = subtotal + delivery;
  const toFree = Math.max(0, freeFrom - subtotal);
  const progress = Math.min(100, (subtotal / freeFrom) * 100);

  return (
    <div className="mx-auto max-w-[1280px] px-4 lg:px-8 py-6 lg:py-10">
      <h1 className="m-0 mb-6 font-display text-ink" style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", lineHeight: 1.15 }}>{t("title")}</h1>

      {/* Lines the catalog no longer carries. Previously they disappeared from
          the total with no explanation. */}
      {unavailable.length > 0 ? (
        <div
          role="status"
          className="mb-5 flex items-start gap-3 rounded-lg p-4"
          style={{ background: "var(--surface-warm)", border: "0.5px solid var(--border-control)" }}
        >
          <Icon name="alert-circle" size={20} color="var(--brass)" />
          <div className="flex-1 min-w-0">
            <p className="m-0 font-sans text-[14px] text-ink">{t("removedTitle")}</p>
            <p className="m-0 mt-1 font-sans text-[13px] text-slate">{unavailable.join(", ")}</p>
          </div>
          <button
            type="button"
            onClick={dismissUnavailable}
            aria-label={t("removedDismiss")}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--slate)" }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
      ) : null}

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 lg:gap-8">
        {/* Items */}
        <div className="flex flex-col gap-3">
          {detailed.map(({ item, qty }) => (
            <div key={item.handle} className="flex gap-3 lg:gap-4 p-3 lg:p-4 rounded-lg border-[0.5px] border-line bg-glaze">
              <Link
                href={`/products/${item.handle}`}
                className="flex-none block rounded-md overflow-hidden bg-porcelain"
                style={{ width: 88, height: 88 }}
              >
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt={item.name} className="vl-photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span className="flex items-center justify-center w-full h-full text-border-strong">
                    <Icon name="package" size={28} strokeWidth={1} />
                  </span>
                )}
              </Link>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <span className="vl-mono text-[11px] uppercase tracking-[0.04em] text-slate">Vita Lux</span>
                    <Link href={`/products/${item.handle}`} className="block truncate font-sans text-[14px] lg:text-[15px] text-ink" style={{ textDecoration: "none" }}>
                      {item.name}
                    </Link>
                  </div>
                  <button type="button" onClick={() => remove(item.handle)} aria-label={t("remove")} className="flex-none p-1.5 text-slate hover:text-danger" style={{ background: "transparent", border: "none", cursor: "pointer" }}>
                    <Icon name="trash" size={18} />
                  </button>
                </div>
                <p className="mt-1 mb-0 font-sans text-[12px] text-slate">{tStock(item.stock)}</p>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-1 h-9 px-1" style={{ border: "1px solid var(--border-control)", borderRadius: "var(--radius-md)" }}>
                    <button type="button" onClick={() => setQty(item.handle, qty - 1)} aria-label={t("less")} className="grid place-items-center w-7 h-7" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ink)" }}>
                      <Icon name="minus" size={16} />
                    </button>
                    <span className="w-7 text-center vl-mono text-[14px] text-ink">{qty}</span>
                    <button type="button" onClick={() => setQty(item.handle, qty + 1)} aria-label={t("more")} className="grid place-items-center w-7 h-7" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ink)" }}>
                      <Icon name="plus" size={16} />
                    </button>
                  </div>
                  {/* Корзина, собранная до появления защиты, хранит снапшот с
                      price = 0. Итог такую строку и так не считает
                      (см. CartContext), но сама строка печатала «0 ₸» как
                      настоящую цену — и оформление падало уже на чекауте. */}
                  {item.priceOnRequest ? (
                    <span className="font-sans text-[14px] lg:text-[15px] text-slate">{tProduct("priceOnRequest")}</span>
                  ) : (
                    <span className="vl-mono font-medium text-[16px] lg:text-[18px] text-ink">{tenge(item.price * qty)}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-6 h-fit">
          <div className="rounded-lg border-[0.5px] border-line bg-glaze p-5">
            {toFree > 0 ? (
              <div className="mb-4 p-3 rounded-md" style={{ background: "var(--beige)" }}>
                <p className="m-0 font-sans text-[13px] text-ink">
                  {t("freeFrom", { amount: groupDigits(toFree) })}
                </p>
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--white)" }}>
                  <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "var(--brass)" }} />
                </div>
              </div>
            ) : (
              <p className="mb-4 font-sans text-[13px]" style={{ color: "var(--success)" }}>✓ {t("freeDone")}</p>
            )}

            <div className="flex flex-col gap-2.5 font-sans text-[14px]">
              <div className="flex items-center justify-between">
                <span className="text-slate">{t("goods")}</span>
                <span className="vl-mono text-ink">{tenge(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate">{t("delivery")}</span>
                <span className="vl-mono text-ink">{delivery === 0 ? t("free") : tenge(delivery)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[0.5px] border-line pt-3">
                <span className="font-medium text-ink">{t("total")}</span>
                <span className="vl-mono font-medium text-[22px] text-ink">{tenge(total)}</span>
              </div>
            </div>

            <div className="mt-5">
              <Link href="/checkout" className="block">
                <Button variant="primary" size="lg" fullWidth iconRight={<Icon name="arrow-right" size={20} />}>
                  {t("checkout")}
                </Button>
              </Link>
            </div>
            <p className="flex items-center justify-center gap-1.5 mt-3 mb-0 font-sans text-[12px] text-slate">
              <Icon name="shield-check" size={15} color="var(--brass)" />
              {t("securePay")}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
