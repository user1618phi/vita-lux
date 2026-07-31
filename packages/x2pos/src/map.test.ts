import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyMarkup,
  findAnomalies,
  guessBrandCode,
  pickImageUrl,
  qtyToStockState,
  slugify,
  suggestHandle,
  toFlag,
  toKzt,
  toQty,
  wholesaleForDisplay,
} from "./map.ts";

/* Run with: pnpm test

   Every case below is taken from the real VITA LUX catalogue, not invented.
   The counts in the comments are what the live API returned when this was
   written: 92 products, 15 with no price, 2 with wholesale above retail,
   4 with no photo, 36 with no stock row at all. */

describe("toKzt", () => {
  it("parses the decimal strings X2pos actually sends", () => {
    assert.equal(toKzt("2550.00"), 2550);
    assert.equal(toKzt("36000.00"), 36_000);
    assert.equal(toKzt("107125.00"), 107_125);
  });

  it("reads 0 as «no price», not as free", () => {
    // 15 of 92 live products sit at 0. They must become «Цена по запросу»,
    // which the schema spells as a null retailKzt.
    assert.equal(toKzt(0), null);
    assert.equal(toKzt("0"), null);
    assert.equal(toKzt("0.00"), null);
  });

  it("treats absent and unparseable values as no price", () => {
    assert.equal(toKzt(null), null);
    assert.equal(toKzt(undefined), null);
    assert.equal(toKzt(""), null);
    assert.equal(toKzt("не указано"), null);
  });

  it("refuses to quote a negative price", () => {
    assert.equal(toKzt("-500.00"), null);
  });

  it("always yields whole tenge — no float reaches the database", () => {
    assert.equal(toKzt("2550.49"), 2550);
    assert.equal(toKzt("2550.50"), 2551);
    for (const raw of ["1400.00", "8575.00", "36000.00", "42350.99"]) {
      assert.ok(Number.isInteger(toKzt(raw)), `${raw} produced a non-integer`);
    }
  });
});

describe("toQty", () => {
  it("parses quantities, including the absent case", () => {
    assert.equal(toQty(15), 15);
    assert.equal(toQty("96"), 96);
    assert.equal(toQty(null), 0);
    assert.equal(toQty(undefined), 0);
  });

  it("keeps negatives — X2pos allows selling into the red", () => {
    // settings_negative_stock_allowed = 1 on this account, so -2 is real data
    // and must not be clamped to 0 behind the owner's back.
    assert.equal(toQty(-2), -2);
  });
});

describe("toFlag", () => {
  it('reads the "0"/"1" strings X2pos uses for booleans', () => {
    assert.equal(toFlag("1"), true);
    assert.equal(toFlag(1), true);
    assert.equal(toFlag("0"), false);
    assert.equal(toFlag(null), false);
    assert.equal(toFlag(undefined), false);
  });
});

describe("qtyToStockState", () => {
  const buffer = 3;

  it("marks a comfortably stocked item as in stock", () => {
    assert.equal(qtyToStockState(45, buffer), "in");
    assert.equal(qtyToStockState(3, buffer), "in");
  });

  it("holds back the last few units as «под заказ»", () => {
    // The buffer is the only defence against the counter selling the same unit
    // seconds later — X2pos has no reservation concept.
    assert.equal(qtyToStockState(2, buffer), "order");
    assert.equal(qtyToStockState(1, buffer), "order");
  });

  it("treats a missing stock row (zero) as orderable, not unavailable", () => {
    // 36 of 92 products have no row. They are still sellable to order, so they
    // must not land on "out", which would disable the add-to-cart button.
    assert.equal(qtyToStockState(0, buffer), "order");
    assert.equal(qtyToStockState(-5, buffer), "order");
  });

  it("never returns «out» for a product that still exists", () => {
    for (let qty = -10; qty <= 200; qty++) {
      assert.notEqual(qtyToStockState(qty, buffer), "out");
    }
  });

  it("keeps a sane threshold when the buffer is misconfigured to 0", () => {
    // A zero buffer would otherwise call an empty shelf "in stock".
    assert.equal(qtyToStockState(0, 0), "order");
    assert.equal(qtyToStockState(1, 0), "in");
  });
});

describe("applyMarkup", () => {
  it("is the identity at 0 bp, so switching this on changes no price", () => {
    assert.equal(applyMarkup(36_000, 0), 36_000);
  });

  it("applies a markup in basis points", () => {
    assert.equal(applyMarkup(10_000, 2_000), 12_000); // +20 %
    assert.equal(applyMarkup(36_000, 1_500), 41_400); // +15 %
  });

  it("rounds up so a quote never undercuts the margin", () => {
    assert.equal(applyMarkup(7_040, 1_000, 1_000), 8_000);
    assert.equal(applyMarkup(36_000, 0, 1_000), 36_000);
  });

  it("leaves «цена по запросу» alone", () => {
    assert.equal(applyMarkup(null, 5_000), null);
  });

  it("rejects a nonsensical markup rather than silently mispricing", () => {
    assert.throws(() => applyMarkup(1_000, -1), RangeError);
    assert.throws(() => applyMarkup(1_000, Number.NaN), RangeError);
  });

  it("returns whole tenge for every plausible input", () => {
    for (const base of [1_400, 6_620, 36_000, 107_125]) {
      for (const bp of [0, 750, 1_500, 3_000]) {
        assert.ok(Number.isInteger(applyMarkup(base, bp)), `${base}/${bp} was not an integer`);
      }
    }
  });
});

describe("wholesaleForDisplay", () => {
  it("shows wholesale when it is genuinely cheaper", () => {
    // Биде Напольный VL-1380F: 36 000 retail / 31 000 wholesale.
    assert.equal(wholesaleForDisplay(36_000, 31_000), 31_000);
  });

  it("hides wholesale when it exceeds retail — a data slip in X2pos", () => {
    // Бачок для Чаши Генуя VL-5254 really is entered as 8575 / 8975.
    assert.equal(wholesaleForDisplay(8_575, 8_975), null);
  });

  it("hides wholesale when the two are equal", () => {
    // Биде Подвесной VL-1303: both 26 500. Showing «оптом от 26 500» next to
    // the same retail figure is noise.
    assert.equal(wholesaleForDisplay(26_500, 26_500), null);
  });

  it("shows nothing when either side is unpriced", () => {
    assert.equal(wholesaleForDisplay(null, 31_000), null);
    assert.equal(wholesaleForDisplay(36_000, null), null);
  });
});

describe("pickImageUrl", () => {
  it("takes the original image", () => {
    const url = "https://adishop.object.pscloud.io/5EF0CAD4.jpeg";
    assert.equal(pickImageUrl({ image_url: url }), url);
  });

  it("returns null when X2pos has no photo", () => {
    // 4 of 92 live products.
    assert.equal(pickImageUrl({ image_url: null }), null);
    assert.equal(pickImageUrl({ image_url: "   " }), null);
    assert.equal(pickImageUrl({}), null);
  });

  it("rejects anything that is not an http(s) URL", () => {
    assert.equal(pickImageUrl({ image_url: "javascript:alert(1)" }), null);
    assert.equal(pickImageUrl({ image_url: "/relative/path.jpg" }), null);
  });
});

describe("slugify", () => {
  it("passes latin article numbers through", () => {
    assert.equal(slugify("VL-1380F"), "vl-1380f");
    assert.equal(slugify("SM-9321"), "sm-9321");
  });

  it("transliterates the Cyrillic vendor codes this catalogue really has", () => {
    // Two live products use Russian words as their article.
    assert.equal(slugify("Квадратный"), "kvadratnyi");
    assert.equal(slugify("Крышка овальная"), "kryshka-ovalnaya");
  });

  it("handles Kazakh glyphs", () => {
    assert.equal(slugify("Әрі"), "ari");
  });

  it("collapses punctuation and trims stray dashes", () => {
    assert.equal(slugify("  VL / 1380 F!  "), "vl-1380-f");
  });

  it("returns an empty string when nothing survives", () => {
    assert.equal(slugify("!!!"), "");
    assert.equal(slugify(""), "");
  });
});

describe("suggestHandle", () => {
  it("builds the handle from the article, never the name", () => {
    // 36 products are all named «Унитаз»; only the article tells them apart.
    assert.equal(suggestHandle("VL-6303", "7418458"), "vl-6303");
  });

  it("falls back to the external id when there is no article", () => {
    // Exactly one live product has no vendor_code.
    assert.equal(suggestHandle(null, "7418458"), "x2pos-7418458");
    assert.equal(suggestHandle("   ", "7418458"), "x2pos-7418458");
  });
});

describe("guessBrandCode", () => {
  it("reads SMOOW off the article prefix", () => {
    // SM-9321 «Унитаз подвесной» is the one SMOOW item in the live catalogue.
    assert.equal(guessBrandCode("SM-9321"), "smoow");
    assert.equal(guessBrandCode("sm-1234"), "smoow");
  });

  it("treats VL- and everything else as own production", () => {
    assert.equal(guessBrandCode("VL-1380F"), "vita-lux");
    assert.equal(guessBrandCode("Квадратный"), "vita-lux");
    assert.equal(guessBrandCode(null), "vita-lux");
  });

  it("never invents a brand outside the whitelist", () => {
    for (const code of ["GR-100", "HG-9", "", "???", "ROCA-1"]) {
      assert.ok(["vita-lux", "smoow"].includes(guessBrandCode(code)), code);
    }
  });
});

describe("findAnomalies", () => {
  const base = {
    externalId: "7418458",
    productName: "Арматура (сливной механизм)",
    vendorCode: "VL-01",
    retailKzt: null,
    wholesaleKzt: null,
    qty: 15,
    imageUrl: "https://adishop.object.pscloud.io/x.jpeg",
  };

  it("flags stock sitting on the shelf with no price", () => {
    // The real VL-01: 15 in stock, priced 0, therefore unsellable online.
    const kinds = findAnomalies(base).map((a) => a.kind);
    assert.deepEqual(kinds, ["no-price-but-in-stock"]);
  });

  it("does not flag an unpriced item that is also out of stock", () => {
    assert.deepEqual(findAnomalies({ ...base, qty: 0 }), []);
  });

  it("flags wholesale at or above retail", () => {
    const kinds = findAnomalies({
      ...base,
      retailKzt: 8_575,
      wholesaleKzt: 8_975,
      qty: 26,
    }).map((a) => a.kind);
    assert.deepEqual(kinds, ["wholesale-above-retail"]);
  });

  it("flags a missing photo and a missing article", () => {
    const kinds = findAnomalies({
      ...base,
      retailKzt: 5_000,
      qty: 1,
      imageUrl: null,
      vendorCode: null,
    }).map((a) => a.kind);
    assert.deepEqual(kinds, ["no-image", "no-vendor-code"]);
  });

  it("stays quiet on a healthy product", () => {
    assert.deepEqual(
      findAnomalies({ ...base, retailKzt: 36_000, wholesaleKzt: 31_000, qty: 21 }),
      [],
    );
  });
});
