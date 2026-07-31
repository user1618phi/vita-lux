// Vita Lux price formatting. Prices are always monospace, tabular figures,
// grouped with a narrow no-break space. Все суммы в тенге — целые числа.

const NBSP = String.fromCharCode(0x00a0); // no-break space emitted by ru-RU grouping
const NNBSP = String.fromCharCode(0x202f); // narrow no-break space (design token)

/** 249900 -> "249 900" (narrow-space grouped, no currency). */
export function groupDigits(n: number): string {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString("ru-RU").split(NBSP).join(NNBSP);
}

/** 249900 -> "249 900 ₸" */
export function formatTenge(n: number): string {
  return groupDigits(n) + NNBSP + "₸";
}

/** 249900 -> "249 900 ₸" обычными пробелами.
    Узкий неразрывный пробел — типографика вёрстки; в чужом текстовом поле
    (WhatsApp, SMS) он ломается или показывается квадратом, поэтому суммы,
    которые уезжают за пределы сайта, форматируем этим. */
export function formatTengePlain(n: number): string {
  return formatTenge(n).split(NNBSP).join(" ").split(NBSP).join(" ");
}

/** Discount percent from old/new. 215000, 189000 -> 12 */
export function benefitPercent(oldPrice: number, newPrice: number): number {
  if (!oldPrice || oldPrice <= newPrice) return 0;
  return Math.round((1 - newPrice / oldPrice) * 100);
}

/** Monthly installment from total and months, rounded up to nearest 10 ₸. */
export function installmentPerMonth(total: number, months: number): number {
  if (!months) return 0;
  return Math.ceil(total / months / 10) * 10;
}
