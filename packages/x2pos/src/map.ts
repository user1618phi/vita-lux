/* Pure translation between the X2pos wire format and our domain.

   Everything here is a total function with no I/O, because this is where the
   integration actually goes wrong: X2pos sends money as strings ("2550.00"),
   a missing stock row instead of a zero, and 0 instead of "no price". Each of
   those has exactly one correct reading, and it is written down once, here,
   under test — not re-guessed at every call site.

   Money rule from the project: KZT is always a whole-tenge integer. No float
   ever leaves this module. */

import type { StockState } from "@vita/core/stock";

export const X2POS_SOURCE = "x2pos";

/** Basis points, same scale as @vita/core/pricing. 10000 bp = ×1.0. */
const BP_SCALE = 10_000;

/**
 * X2pos money → whole tenge, or `null` when there is no price at all.
 *
 * X2pos writes an unset price as the number 0 (15 of the 92 live products are
 * like this), and our schema spells "no published price" as `retailKzt = null`,
 * which the storefront already renders as «Цена по запросу» and refuses to add
 * to the cart. Collapsing 0 → null here is what wires those two facts together.
 *
 * Accepts strings because X2pos quotes decimals ("2550.00") and integers alike.
 */
export function toKzt(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  // A negative price is corrupt data, not a discount. Treat it as unpriced and
  // let the anomaly report surface it rather than quoting a negative amount.
  if (n <= 0) return null;
  return Math.round(n);
}

/** Same parse, but for quantities: absent means zero, and negatives are real. */
export function toQty(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === "") return 0;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

/** X2pos booleans arrive as the strings "0"/"1". */
export function toFlag(raw: string | number | boolean | null | undefined): boolean {
  return raw === "1" || raw === 1 || raw === true;
}

/**
 * Warehouse quantity → the storefront's three-state availability.
 *
 * The buffer exists because X2pos has no reservation concept and allows
 * selling into negative stock (`settings_negative_stock_allowed = 1`): the
 * same unit can be sold at the counter seconds after a customer adds it to a
 * cart online. Holding back the last few units is the only defence we have.
 *
 * Nothing here ever returns "out" — "out" blocks the add-to-cart button, and a
 * warehouse item at zero can still be ordered in. "out" is reserved for
 * products X2pos has archived or deleted; see `stateForMissingProduct`.
 */
export function qtyToStockState(qty: number, bufferQty: number): StockState {
  return qty >= Math.max(bufferQty, 1) ? "in" : "order";
}

/** A product X2pos deleted or archived can no longer be sold at all. */
export function stateForMissingProduct(): StockState {
  return "out";
}

/**
 * Apply the shop-wide markup to the price X2pos quotes.
 *
 * Rounding is up, reusing the reasoning already settled in @vita/core/pricing:
 * rounding up can never quote a customer below the intended margin. A markup
 * of 0 bp is the identity, so the default configuration ships X2pos prices
 * through untouched — no surprise price change on the day this lands.
 */
export function applyMarkup(baseKzt: number | null, markupBp: number, roundTo = 1): number | null {
  if (baseKzt === null) return null;
  if (!Number.isFinite(markupBp) || markupBp < 0) {
    throw new RangeError(`markupBp must be a finite non-negative number, got ${markupBp}`);
  }
  const step = Number.isFinite(roundTo) && roundTo >= 1 ? roundTo : 1;
  const marked = baseKzt * ((BP_SCALE + markupBp) / BP_SCALE);
  return step <= 1 ? Math.ceil(marked) : Math.ceil(marked / step) * step;
}

/**
 * The wholesale figure to show next to the retail one — or `null` to hide it.
 *
 * Two of the 92 live products have a wholesale price *above* retail, which is
 * a data-entry slip in X2pos. Showing it would quote a customer more for
 * buying more. We hide it and report it; fixing the number is the owner's job
 * in X2pos, not something to paper over in code.
 */
export function wholesaleForDisplay(
  retailKzt: number | null,
  wholesaleKzt: number | null,
): number | null {
  if (retailKzt === null || wholesaleKzt === null) return null;
  return wholesaleKzt < retailKzt ? wholesaleKzt : null;
}

/**
 * Full-size image URL, or null.
 *
 * Deliberately ignores `image_thumb_url`: on the live CDN the "thumbnail" is
 * *larger* than the original (95 KB vs 83 KB), so it is worse than useless.
 * We take the original and generate our own derivatives with the existing
 * `processPhoto` pipeline.
 */
export function pickImageUrl(source: { image_url?: string | null }): string | null {
  const url = source.image_url?.trim();
  if (!url) return null;
  return url.startsWith("http://") || url.startsWith("https://") ? url : null;
}

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  // Kazakh-specific glyphs — vendor codes in this catalogue are hand-typed and
  // do contain Cyrillic ("Крышка овальная"), so this has to be total.
  ә: "a", ғ: "g", қ: "q", ң: "ng", ө: "o", ұ: "u", ү: "u", һ: "h", і: "i",
};

/** Lowercase, transliterated, URL-safe. Empty string if nothing survives. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A provisional handle for a product X2pos has but the site does not.
 *
 * The article is the only thing in this catalogue that distinguishes one row
 * from another — 36 products are literally all named «Унитаз» — so the handle
 * is built from the article, never from the name. It is a placeholder: the
 * product lands as a draft and an admin gives it a real handle before it can
 * ever be published.
 */
export function suggestHandle(vendorCode: string | null | undefined, externalId: string): string {
  const fromCode = slugify(vendorCode ?? "");
  return fromCode.length > 0 ? fromCode : `x2pos-${externalId}`;
}

/**
 * Which of the two allowed brands an article belongs to.
 *
 * The brand whitelist is closed — `vita-lux` and `smoow`, nothing else, ever —
 * and X2pos does not carry a usable brand field (5 of 92 products fill it).
 * The article prefix does carry it: SM-9321 is SMOOW, VL-* is own production.
 * Anything unrecognised falls back to own production, which is the safe guess
 * for a warehouse of Vita Lux's own goods.
 */
export function guessBrandCode(vendorCode: string | null | undefined): "vita-lux" | "smoow" {
  return /^\s*sm[-\s]/i.test(vendorCode ?? "") ? "smoow" : "vita-lux";
}

/* ── anomaly reporting ─────────────────────────────────────────────────── */

export type AnomalyKind =
  | "no-price-but-in-stock"
  | "wholesale-above-retail"
  | "no-image"
  | "no-vendor-code";

export interface Anomaly {
  kind: AnomalyKind;
  externalId: string;
  productName: string;
  vendorCode: string | null;
  detail: string;
}

/**
 * Things a human should look at in X2pos. Not errors — the sync completes
 * regardless — but each one is a product that will under-perform or not sell
 * at all until someone edits it at the source.
 */
export function findAnomalies(input: {
  externalId: string;
  productName: string;
  vendorCode: string | null;
  retailKzt: number | null;
  wholesaleKzt: number | null;
  qty: number;
  imageUrl: string | null;
}): Anomaly[] {
  const out: Anomaly[] = [];
  const base = {
    externalId: input.externalId,
    productName: input.productName,
    vendorCode: input.vendorCode,
  };

  if (input.retailKzt === null && input.qty > 0) {
    out.push({
      ...base,
      kind: "no-price-but-in-stock",
      detail: `на складе ${input.qty} шт, но цена не заполнена — товар не продаётся`,
    });
  }
  if (
    input.retailKzt !== null &&
    input.wholesaleKzt !== null &&
    input.wholesaleKzt >= input.retailKzt
  ) {
    out.push({
      ...base,
      kind: "wholesale-above-retail",
      detail: `опт ${input.wholesaleKzt} ₸ не ниже розницы ${input.retailKzt} ₸ — опт скрыт на сайте`,
    });
  }
  if (input.imageUrl === null) {
    out.push({ ...base, kind: "no-image", detail: "нет фото в X2pos" });
  }
  if (!input.vendorCode?.trim()) {
    out.push({ ...base, kind: "no-vendor-code", detail: "нет артикула — handle будет техническим" });
  }
  return out;
}
