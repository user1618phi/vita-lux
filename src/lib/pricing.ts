/* Retail price derivation: wholesale USD → retail tenge.

   The one place rounding happens. Every amount is an integer — USD in cents,
   KZT in whole tenge — so no float ever reaches the database or an order.

   Markup is in basis points to stay integral: 10000 bp = ×1.0 (no markup),
   22000 bp = ×2.2. */

export const BP_SCALE = 10_000;

export interface RetailInput {
  /** Wholesale price in USD cents. $63 → 6300. */
  wholesaleUsdCents: number;
  /** Markup in basis points over wholesale. 22000 = ×2.2. */
  markupBp: number;
  /** USD → KZT rate, e.g. 522.5. */
  fxRate: number;
  /** Round the result up to this step in tenge. 1000 → 45 000, not 45 314. */
  roundTo?: number;
}

/**
 * Retail price in whole tenge, rounded UP to `roundTo`.
 *
 * Rounding up rather than to-nearest is deliberate: it can never quote a
 * customer less than the intended margin.
 *
 * @throws RangeError on negative or non-finite input — a bad rate must fail
 *         loudly at the point of entry, not silently produce a ₸0 product.
 */
export function retail({ wholesaleUsdCents, markupBp, fxRate, roundTo = 1000 }: RetailInput): number {
  assertFinitePositive(wholesaleUsdCents, "wholesaleUsdCents");
  assertFinitePositive(markupBp, "markupBp");
  assertFinitePositive(fxRate, "fxRate");
  if (!Number.isFinite(roundTo) || roundTo < 1) {
    throw new RangeError(`roundTo must be >= 1, got ${roundTo}`);
  }

  // cents → dollars → tenge, with markup applied before the currency conversion.
  const tenge = (wholesaleUsdCents / 100) * (markupBp / BP_SCALE) * fxRate;
  return roundUpTo(tenge, roundTo);
}

/** Round a tenge amount up to the nearest `step`. */
export function roundUpTo(amount: number, step: number): number {
  if (step <= 1) return Math.ceil(amount);
  return Math.ceil(amount / step) * step;
}

/** Inverse of `retail` for the admin: what markup does this retail price imply? */
export function impliedMarkupBp(retailKzt: number, wholesaleUsdCents: number, fxRate: number): number {
  assertFinitePositive(retailKzt, "retailKzt");
  assertFinitePositive(fxRate, "fxRate");
  if (wholesaleUsdCents <= 0) throw new RangeError("wholesaleUsdCents must be > 0");
  const wholesaleKzt = (wholesaleUsdCents / 100) * fxRate;
  return Math.round((retailKzt / wholesaleKzt) * BP_SCALE);
}

function assertFinitePositive(n: number, label: string): void {
  if (!Number.isFinite(n) || n < 0) {
    throw new RangeError(`${label} must be a finite non-negative number, got ${n}`);
  }
}
