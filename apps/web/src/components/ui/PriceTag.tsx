import type { CSSProperties } from "react";
import { benefitPercent, formatTenge } from "@vita/core/format";

/* PriceTag — price in monospace, old price struck through, benefit percent.
   Prices are NEVER set in the serif. Size: sm | md | lg. `benefitText` is the
   already-localized "Выгода N%" string (kept out of JSX literals for i18n). */

/* `request` — кегль подписи «Цена по запросу». Он заметно меньше `now`
   намеренно: это фраза, а не число, ей не нужен вес цифры. Плюс казахский
   вариант — «Бағасы сұраныс бойынша», 22 символа против 15 русских, и
   кеглем 30 он упирался бы в края экрана на 390px. */
const SIZES = {
  sm: { now: 16, old: 12, benefit: 11, request: 13 },
  md: { now: 22, old: 14, benefit: 12, request: 15 },
  lg: { now: 30, old: 16, benefit: 13, request: 20 },
} as const;

export interface PriceTagProps {
  price: number;
  oldPrice?: number;
  /** Оптовая цена. Уже проверена на «строго ниже розницы» источником каталога. */
  wholesalePrice?: number;
  /** Локализованная строка вида «оптом от 31 000 ₸». Без неё опт не рисуется. */
  wholesaleText?: string;
  /** У товара нет розничной цены (`retailKzt is null` в каталоге). */
  priceOnRequest?: boolean;
  /** Локализованное «Цена по запросу». Без него ценник не рисуется вовсе. */
  onRequestLabel?: string;
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
  priceOnRequest,
  onRequestLabel,
  size = "md",
  showBenefit = true,
  benefitText,
  style,
}: PriceTagProps) {
  const s = SIZES[size] ?? SIZES.md;
  const pct = oldPrice ? benefitPercent(oldPrice, price) : 0;

  /* Часть каталога продаётся «по запросу»: `retailKzt` в базе null, и репозиторий
     отдаёт price = 0. Напечатать это как «0 ₸» — не косметическая оплошность, а
     ценовое предложение, которого не существует: рядом стоит активная кнопка
     «В корзину», а чекаут такой заказ потом отбивает.

     Проверка на `price <= 0` намеренно шире флага: ценник не имеет права
     напечатать нулевую сумму, даже если вызывающий забыл передать признак.
     Отсутствие подписи означает, что зовущий не подумал об этом случае, —
     пустое место честнее нуля, поэтому здесь ничего не рисуется. */
  if (priceOnRequest || price <= 0) {
    if (!onRequestLabel) return null;
    return (
      <div style={{ display: "flex", alignItems: "baseline", ...style }}>
        <span
          className="font-sans"
          style={{ fontWeight: 500, fontSize: s.request, color: "var(--text-primary)", lineHeight: 1.15 }}
        >
          {onRequestLabel}
        </span>
      </div>
    );
  }

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
