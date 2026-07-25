"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PriceTag } from "@/components/ui/PriceTag";
import { StockStatus } from "@/components/ui/StockStatus";
import { PhotoGallery } from "@/components/product/PhotoGallery";
import { useCart } from "@/context/CartContext";
import { getCatalogItem } from "@/data/catalog";
import { benefitPercent } from "@/lib/format";
import { track } from "@/lib/analytics";

/* QuickView — product preview modal opened from a catalog card. Bottom-sheet on
   mobile, centred modal on desktop. Self-sufficient given a handle. Monobrand,
   no ratings. */

export function QuickView({ handle, onClose }: { handle: string; onClose: () => void }) {
  const t = useTranslations("QuickView");
  const tCat = useTranslations("Catalog");
  const tStock = useTranslations("Stock");
  const tPrice = useTranslations("Price");
  const tProduct = useTranslations("Product");
  const tFilters = useTranslations("Filters");
  const tpg = useTranslations("ProductGeneric");
  const { add, toggleFavorite, isFavorite } = useCart();
  const [qty, setQty] = useState(1);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const item = getCatalogItem(handle);
  if (!item) return null;

  const names = tCat.raw("names") as Record<string, string>;
  const name = names[handle] ?? handle;
  const collectionName = tFilters(`collections.${item.collection}`);
  const pct = item.oldPrice ? benefitPercent(item.oldPrice, item.price) : 0;
  const benefitText = pct > 0 ? tPrice("benefit", { pct }) : undefined;
  const gallery = item.gallery?.length ? item.gallery : item.image ? [item.image] : [];
  const fav = isFavorite(handle);
  const soldOut = item.stock === "out";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      className="fixed inset-0 flex items-end justify-center md:items-center md:p-6"
      style={{ zIndex: 60 }}
    >
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="animate-[vl-fadein_0.28s_ease-out]"
        style={{ position: "absolute", inset: 0, border: "none", padding: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", cursor: "pointer" }}
      />

      <div
        className="w-full md:max-w-3xl vl-noscroll rounded-t-lg md:rounded-lg animate-[vl-sheetup_0.28s_ease-out] md:animate-[vl-scalein_0.28s_ease-out]"
        style={{
          position: "relative",
          maxHeight: "92vh",
          overflowY: "auto",
          background: "var(--white)",
        }}
      >
        <button
          type="button"
          aria-label={t("close")}
          onClick={onClose}
          className="absolute top-3 right-3 z-10 inline-flex items-center justify-center rounded-full"
          style={{ width: 40, height: 40, background: "var(--white)", border: "0.5px solid var(--border)", cursor: "pointer", color: "var(--ink)" }}
        >
          <Icon name="x" size={22} color="var(--ink)" />
        </button>

        <div className="grid md:grid-cols-2">
          <div className="p-4 md:p-5">
            <PhotoGallery images={gallery} alt={name} />
          </div>

          <div className="p-4 md:p-6 md:pt-8">
            <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-brass-text">
              {tpg("collectionEyebrow", { name: collectionName })}
            </div>
            <h2 className="mt-1.5 mb-0 font-display text-[22px] lg:text-[26px] leading-[1.15] text-ink">{name}</h2>

            <div className="mt-2.5">
              <StockStatus status={item.stock} label={tStock(item.stock)} size="sm" />
            </div>

            <div className="mt-4">
              <PriceTag price={item.price} oldPrice={item.oldPrice} size="md" benefitText={benefitText} />
            </div>

            <div className="mt-5 flex items-center gap-2.5">
              <div className="flex items-center gap-1 h-11 px-1.5" style={{ border: "1px solid var(--border-control)", borderRadius: "var(--radius-md)" }}>
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={tProduct("addToCart")} className="grid place-items-center w-8 h-8" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ink)" }}>
                  <Icon name="minus" size={16} />
                </button>
                <span className="w-7 text-center vl-mono text-ink">{qty}</span>
                <button type="button" onClick={() => setQty((q) => q + 1)} aria-label={tProduct("addToCart")} className="grid place-items-center w-8 h-8" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ink)" }}>
                  <Icon name="plus" size={16} />
                </button>
              </div>
              <div className="flex-1">
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  disabled={soldOut}
                  iconLeft={<Icon name="shopping-bag" size={20} />}
                  onClick={() => {
                    add(handle, qty);
                    track("add_to_cart", { sku: handle, quantity: qty });
                  }}
                >
                  {tProduct("addToCart")}
                </Button>
              </div>
              <button
                type="button"
                onClick={() => toggleFavorite(handle)}
                aria-label={fav ? tProduct("favoriteRemove") : tProduct("favoriteAdd")}
                aria-pressed={fav}
                className="grid place-items-center rounded-md"
                style={{ width: 44, height: 44, flex: "none", border: "1px solid var(--border-control)", background: "transparent", cursor: "pointer", color: fav ? "var(--brass)" : "var(--slate)" }}
              >
                <Icon name="heart" size={20} />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2 font-sans text-[13px] text-slate">
              <p className="m-0 flex items-center gap-2">
                <Icon name="truck" size={16} color="var(--brass)" />
                {t("delivery")}
              </p>
              <p className="m-0 flex items-center gap-2">
                <Icon name="shield-check" size={16} color="var(--brass)" />
                {t("warranty")}
              </p>
            </div>

            <Link
              href={`/products/${handle}`}
              onClick={onClose}
              className="mt-4 inline-flex items-center gap-1.5 font-sans text-[14px] text-brass-text"
            >
              {t("more")}
              <Icon name="arrow-right" size={16} color="var(--brass)" />
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
