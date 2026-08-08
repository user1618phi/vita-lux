"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Icon } from "./Icon";
import { ProductLabel } from "./ProductLabel";
import { StockStatus, type StockState } from "./StockStatus";
import { PriceTag } from "./PriceTag";
import { InstallmentLine } from "./InstallmentLine";
import { Button } from "./Button";
import { useCart } from "@/context/CartContext";
import type { LineSnapshot } from "@/app/actions/catalog";
import { track } from "@vita/core/analytics";
import { QuickView } from "@/components/commerce/QuickView";

/* ProductCard — photo 4:5, label, favorite, name, stock, old + new price,
   benefit, installment line, add-to-cart. Border + air only (no shadow).
   All human-readable strings are passed in already localized. */

export interface ProductCardProps {
  name: string;
  href: string;
  handle: string;
  /** Настоящий артикул. Без него снапшот корзины подделывает его из хендла. */
  sku?: string;
  image?: string;
  price: number;
  oldPrice?: number;
  wholesalePrice?: number;
  /** Цена по запросу: ценник печатает подпись, кнопка гаснет. */
  priceOnRequest?: boolean;
  status?: StockState;
  months?: number;
  productLabel?: { kind: "hit" | "sale" | "new"; text: string };
  labels: {
    stock: string;
    addToCart: string;
    installmentFrom: string;
    months: string;
    favoriteAdd: string;
    favoriteRemove: string;
    /* Обязателен намеренно: пропуск делает вызов ошибкой типов, а не карточкой
       с «0 ₸» — товары без цены есть в каталоге всегда. */
    priceOnRequest: string;
    /* Тоже обязателен: товар без фотографии в каталоге — нормальное состояние,
       а не исключение, и молчаливая серая плитка выглядит поломкой. */
    photoPending: string;
    benefit?: string;
    /* Уже подставленная строка «оптом от N ₸». Готовой её собирает страница —
       компоненты не форматируют деньги и не знают про локаль. */
    wholesaleFrom?: string;
  };
  style?: CSSProperties;
}

export function ProductCard({
  name,
  href,
  handle,
  sku,
  image,
  price,
  oldPrice,
  wholesalePrice,
  priceOnRequest,
  status = "in",
  months = 12,
  productLabel,
  labels,
  style,
}: ProductCardProps) {
  const { add, toggleFavorite, isFavorite } = useCart();
  const tQV = useTranslations("QuickView");
  const [hover, setHover] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const fav = isFavorite(handle);
  const soldOut = status === "out";
  /* Два разных состояния, а не одно. Снятый с продажи товар гасится фотографией,
     а товар в наличии, но без цены, выглядит обычным — просто его нельзя
     положить в корзину, пока цену не назовут. Приглушать его как распроданный
     значило бы сказать о наличии неправду. */
  const unbuyable = soldOut || Boolean(priceOnRequest);

  /* The card already has everything the cart needs to render, so hand it over
     on add — the line paints with a real name and price immediately, and the
     server revalidation that follows only confirms it.

     Артикул и признак «по запросу» приходят пропсами: раньше они здесь
     выдумывались (`handle.toUpperCase()` и жёсткий `false`), и до ответа
     `resolveHandles` корзина показывала чужой артикул и цену 0 ₸ как настоящую. */
  const snapshot: LineSnapshot = {
    handle,
    sku: sku ?? handle.toUpperCase(),
    name,
    price,
    oldPrice,
    wholesalePrice,
    image,
    collection: "",
    stock: status,
    priceOnRequest: priceOnRequest ?? false,
    badge: productLabel?.kind,
    installmentMonths: months,
  };
  return (
    <>
    <div
      className="group"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-card)",
        border: "0.5px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        height: "100%",
        ...style,
      }}
    >
      <Link
        href={href}
        style={{ position: "relative", display: "block", aspectRatio: "4 / 5", background: "var(--surface-media)", overflow: "hidden" }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={name}
            loading="lazy"
            className="vl-photo"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: hover ? "scale(1.03)" : "scale(1)",
              transition: "transform var(--transition)",
              opacity: soldOut ? 0.55 : 1,
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "0 12px",
              textAlign: "center",
              color: "var(--border-strong)",
              transform: hover ? "scale(1.03)" : "scale(1)",
              transition: "transform var(--transition)",
              opacity: soldOut ? 0.55 : 1,
            }}
          >
            <Icon name="package" size={40} strokeWidth={1} />
            {/* Одна иконка читается как «не загрузилось». Подпись говорит, что
                товар настоящий, а снимка пока нет. */}
            <span className="font-sans text-[11px] leading-[1.3]" style={{ color: "var(--text-secondary)" }}>
              {labels.photoPending}
            </span>
          </div>
        )}
        {productLabel ? (
          <div style={{ position: "absolute", top: 12, left: 12 }}>
            <ProductLabel kind={productLabel.kind}>{productLabel.text}</ProductLabel>
          </div>
        ) : null}
        <button
          type="button"
          aria-label={fav ? labels.favoriteRemove : labels.favoriteAdd}
          aria-pressed={fav}
          onClick={(e) => {
            e.preventDefault();
            toggleFavorite(handle, snapshot);
          }}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 40,
            height: 40,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--surface-card)",
            border: "0.5px solid var(--border)",
            borderRadius: "var(--radius-md)",
            color: fav ? "var(--brass)" : "var(--slate)",
            cursor: "pointer",
          }}
        >
          <Icon name="heart" size={20} />
        </button>

        {/* Quick view — appears on hover (desktop). */}
        <button
          type="button"
          aria-label={tQV("quickView")}
          onClick={(e) => {
            e.preventDefault();
            setQuickOpen(true);
          }}
          className="absolute inset-x-2.5 bottom-2.5 hidden md:flex items-center justify-center gap-2 opacity-0 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0"
          style={{ height: 36, background: "var(--white)", border: "0.5px solid var(--border)", borderRadius: "var(--radius-md)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink)" }}
        >
          <Icon name="eye" size={16} color="var(--ink)" />
          {tQV("quickView")}
        </button>
      </Link>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, flex: 1 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-micro)", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
          Vita Lux
        </span>
        <Link
          href={href}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body)",
            color: "var(--text-primary)",
            textDecoration: "none",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: "2.6em",
          }}
        >
          {name}
        </Link>
        <StockStatus status={status} label={labels.stock} size="sm" />
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6, paddingTop: 8 }}>
          <PriceTag
            price={price}
            oldPrice={oldPrice}
            wholesalePrice={wholesalePrice}
            wholesaleText={labels.wholesaleFrom}
            size="md"
            benefitText={labels.benefit}
            priceOnRequest={priceOnRequest}
            onRequestLabel={labels.priceOnRequest}
          />
          {/* «В рассрочку от 0 ₸ × 24 мес» под ценой, которой нет. */}
          {!priceOnRequest ? (
            <InstallmentLine total={price} months={months} fromLabel={labels.installmentFrom} monthsLabel={labels.months} />
          ) : null}
        </div>
        <div style={{ marginTop: 4 }}>
          <Button
            variant={unbuyable ? "secondary" : "primary"}
            size="md"
            fullWidth
            disabled={unbuyable}
            iconLeft={!unbuyable ? <Icon name="shopping-bag" size={20} /> : null}
            onClick={() => {
              if (unbuyable) return;
              add(handle, 1, snapshot);
              track("add_to_cart", { sku: handle, quantity: 1 });
            }}
          >
            {labels.addToCart}
          </Button>
        </div>
      </div>
    </div>
    {quickOpen ? <QuickView handle={handle} onClose={() => setQuickOpen(false)} /> : null}
    </>
  );
}
