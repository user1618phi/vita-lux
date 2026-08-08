import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDimensions, formatTenge, formatTengePlain, groupDigits } from "./format.ts";

/* Run with: pnpm test

   Смысл разделения: на сайте суммы набраны узким неразрывным пробелом (это
   часть типографики), а всё, что уезжает в чужое текстовое поле — заготовка
   сообщения в WhatsApp — обязано быть на обычных пробелах. Проверяем это
   именно по кодам символов: глазами U+202F от пробела не отличить, и regression
   здесь прошёл бы незамеченным до первой переписки с покупателем. */

const NBSP = " ";
const NNBSP = " ";

describe("formatTenge", () => {
  it("groups thousands with a narrow no-break space and appends the sign", () => {
    assert.equal(formatTenge(189_000), `189${NNBSP}000${NNBSP}₸`);
  });
});

describe("formatTengePlain", () => {
  it("says the same thing as formatTenge", () => {
    assert.equal(formatTengePlain(189_000).replace(/ /g, ""), formatTenge(189_000).replace(/[\s  ]/g, ""));
  });

  it("uses ordinary spaces only", () => {
    for (const n of [0, 900, 189_000, 1_250_000]) {
      const s = formatTengePlain(n);
      assert.ok(!s.includes(NNBSP), `${n}: остался узкий неразрывный пробел в «${s}»`);
      assert.ok(!s.includes(NBSP), `${n}: остался неразрывный пробел в «${s}»`);
    }
  });

  it("survives a round trip through a URL", () => {
    const msg = `Цена: ${formatTengePlain(189_000)}`;
    assert.equal(decodeURIComponent(encodeURIComponent(msg)), msg);
    assert.equal(msg, "Цена: 189 000 ₸");
  });
});

describe("groupDigits", () => {
  it("rounds to whole tenge — не даём копейкам дойти до цены", () => {
    assert.equal(groupDigits(7879.6), `7${NNBSP}880`);
  });
});

describe("formatDimensions", () => {
  it("собирает тройку в «Ш × Г × В»", () => {
    assert.equal(formatDimensions(700, 380, 670), "700 × 380 × 670");
  });

  it("молчит, если известны не все три", () => {
    /* Подпись строки характеристик обещает «Ш × Г × В». Показать под ней две
       цифры из трёх — не сокращение, а неверное утверждение о габаритах
       товара, который человек собирается втиснуть в санузел. */
    assert.equal(formatDimensions(700, 380, null), null);
    assert.equal(formatDimensions(700, undefined, 670), null);
    assert.equal(formatDimensions(null, null, null), null);
    assert.equal(formatDimensions(undefined, undefined, undefined), null);
  });

  it("считает ноль отсутствующим размером", () => {
    assert.equal(formatDimensions(700, 0, 670), null);
  });
});
