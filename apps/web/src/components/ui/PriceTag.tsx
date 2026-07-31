import type { CSSProperties } from "react";
import { benefitPercent, formatTenge } from "@vita/core/format";

/* PriceTag — price in monospace, old price struck through, benefit percent.
   Prices are NEVER set in the serif. Size: sm | md | lg. `benefitText` is the
   already-localized "Выгода N%" string (kept out of JSX literals for i18n). */

const SIZES = {
  sm: { now: 16, old: 12, benefit: 11 },
  md: { now: 22, old: 14, benefit: 12 },
  lg: { now: 30, old: 16, benefit: 13 },
} as const;

export interface PriceTagProps {
  price: number;
  oldPrice?: number;
  /** Оптовая цена. Уже проверена на «строго ниже розницы» источником каталога. */
  wholesalePrice?: number;
  /** Локализованная строка вида «оптом от 31 000 ₸». Без неё опт не рисуется. */
  wholesaleText?: string;
  size?: keyof typeof SIZES;
  showBenefit?: boolean;
  benefitText?: string;
  style?: CSSProperties;
}

export function PriceTag({
  price,
  oldPrice,
  wholesalePrice,
  wholesaleText,
  size = "md",
  showBenefit = true,
  benefitText,
  style,
}: PriceTagProps) {
  const s = SIZES[size] ?? SIZES.md;
  const pct = oldPrice ? benefitPercent(oldPrice, price) : 0;

  /* Опт — отдельной строкой под розницей, а не в общем ряду: склад оптовый, и
     оптовая цена интересна части покупателей, но розничная всё равно остаётся
     главной цифрой карточки. Второй строкой она не спорит с ней за внимание и
     не ломает вёрстку на 390px, где ряд из четырёх чисел уже переносится. */
  const wholesale =
    wholesalePrice && wholesaleText && wholesalePrice < price ? (
      <div
        className="vl-mono"
        style={{ fontSize: s.benefit, color: "var(--text-secondary)", lineHeight: 1.3 }}
      >
        {wholesaleText}
      </div>
    ) : null;

  if (wholesale) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
        <PriceTag
          price={price}
          oldPrice={oldPrice}
          size={size}
          showBenefit={showBenefit}
          benefitText={benefitText}
        />
        {wholesale}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "8px 10px", ...style }}>
      <span
        className="vl-mono"
        style={{ fontWeight: 500, fontSize: s.now, color: "var(--text-primary)", lineHeight: 1 }}
      >
        {formatTenge(price)}
      </span>
      {oldPrice && oldPrice > price ? (
        <span
          className="vl-mono"
          style={{
            fontSize: s.old,
            color: "var(--text-secondary)",
            textDecoration: "line-through",
            textDecorationColor: "var(--slate)",
            lineHeight: 1,
          }}
        >
          {formatTenge(oldPrice)}
        </span>
      ) : null}
      {showBenefit && pct > 0 && benefitText ? (
        <span
          className="vl-mono"
          style={{ fontSize: s.benefit, color: "var(--state-success)", lineHeight: 1 }}
        >
          {benefitText}
        </span>
      ) : null}
    </div>
  );
}
