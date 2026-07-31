import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { impliedMarkupBp, retail, roundUpTo } from "./pricing.ts";

/* Run with: pnpm test
   Money rounding is the one piece of logic where a silent off-by-one becomes a
   wrong price on a real invoice, so it gets the first tests in the project. */

describe("retail", () => {
  it("derives a retail price from wholesale USD, markup and FX", () => {
    // $63 × 2.2 × 522.5 ₸ = 72 419.7 ₸ → rounds up to 73 000
    assert.equal(retail({ wholesaleUsdCents: 6300, markupBp: 22000, fxRate: 522.5 }), 73_000);
  });

  it("rounds UP so a quote never undercuts the intended margin", () => {
    // Exactly 45 000.01 must not become 45 000.
    const r = retail({ wholesaleUsdCents: 10_000, markupBp: 10_000, fxRate: 450.0001, roundTo: 1000 });
    assert.equal(r, 46_000);
  });

  it("leaves an amount already on the step untouched", () => {
    // $100 × 1.0 × 500 = 50 000 exactly.
    assert.equal(retail({ wholesaleUsdCents: 10_000, markupBp: 10_000, fxRate: 500, roundTo: 1000 }), 50_000);
  });

  it("honours a finer rounding step", () => {
    assert.equal(retail({ wholesaleUsdCents: 6300, markupBp: 22000, fxRate: 522.5, roundTo: 100 }), 72_500);
  });

  it("returns whole tenge for every plausible input", () => {
    for (const cents of [3100, 6300, 9600, 19_800]) {
      for (const bp of [15_000, 22_000, 27_500]) {
        const r = retail({ wholesaleUsdCents: cents, markupBp: bp, fxRate: 522.37 });
        assert.ok(Number.isInteger(r), `${cents}/${bp} produced a non-integer: ${r}`);
      }
    }
  });

  it("rejects a non-finite FX rate instead of quoting ₸0", () => {
    assert.throws(() => retail({ wholesaleUsdCents: 6300, markupBp: 22000, fxRate: NaN }), RangeError);
    assert.throws(() => retail({ wholesaleUsdCents: 6300, markupBp: 22000, fxRate: -1 }), RangeError);
  });

  it("rejects a zero rounding step", () => {
    assert.throws(
      () => retail({ wholesaleUsdCents: 6300, markupBp: 22000, fxRate: 522.5, roundTo: 0 }),
      RangeError,
    );
  });
});

describe("roundUpTo", () => {
  it("rounds up to the step", () => {
    assert.equal(roundUpTo(45_001, 1000), 46_000);
    assert.equal(roundUpTo(45_000, 1000), 45_000);
    assert.equal(roundUpTo(0, 1000), 0);
  });

  it("ceils when the step is 1", () => {
    assert.equal(roundUpTo(45_000.2, 1), 45_001);
  });
});

describe("impliedMarkupBp", () => {
  it("is the inverse of retail before rounding", () => {
    const fx = 522.5;
    const cents = 6300;
    const bp = impliedMarkupBp(72_420, cents, fx);
    assert.ok(Math.abs(bp - 22_000) <= 5, `expected ~22000 bp, got ${bp}`);
  });

  it("rejects a zero wholesale price", () => {
    assert.throws(() => impliedMarkupBp(72_420, 0, 522.5), RangeError);
  });
});
