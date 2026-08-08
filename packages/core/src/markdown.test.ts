import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSimpleMarkdown, stripMarkdown } from "./markdown.ts";

/* Run with: pnpm test

   Грамматика закрыта, и это её главное свойство: описание товара приходит из
   админки, то есть из чужих рук, а компонент рисует результат разбора как
   обычные React-узлы. Поэтому тесты проверяют не только «что разобралось», но и
   что разбор НЕ порождает ничего, кроме абзацев и пунктов списка. */

describe("parseSimpleMarkdown", () => {
  it("делит абзацы пустой строкой", () => {
    assert.deepEqual(parseSimpleMarkdown("Первый.\n\nВторой."), [
      { kind: "p", text: "Первый." },
      { kind: "p", text: "Второй." },
    ]);
  });

  it("схлопывает одиночный перенос внутри абзаца в пробел", () => {
    assert.deepEqual(parseSimpleMarkdown("Унитаз-моноблок\nс горизонтальным выпуском."), [
      { kind: "p", text: "Унитаз-моноблок с горизонтальным выпуском." },
    ]);
  });

  it("собирает подряд идущие пункты в один список", () => {
    assert.deepEqual(parseSimpleMarkdown("- Дюропласт\n- Душевой смыв\n* Выпуск в пол"), [
      { kind: "ul", items: ["Дюропласт", "Душевой смыв", "Выпуск в пол"] },
    ]);
  });

  it("разделяет абзац и список без пустой строки между ними", () => {
    assert.deepEqual(parseSimpleMarkdown("Характеристики:\n- Ширина 700 мм\n- Высота 670 мм"), [
      { kind: "p", text: "Характеристики:" },
      { kind: "ul", items: ["Ширина 700 мм", "Высота 670 мм"] },
    ]);
  });

  it("на пустом входе отдаёт пустой список блоков", () => {
    for (const empty of ["", "   \n\n  ", null, undefined]) {
      assert.deepEqual(parseSimpleMarkdown(empty), []);
    }
  });

  it("не выпускает ничего, кроме абзацев и списков", () => {
    /* HTML, ссылка и картинка обязаны остаться текстом. Если однажды кто-то
       добавит сюда инлайновый разбор, этот тест упадёт — и это правильно:
       ссылка на чужой бренд в описании товара стоит дилерского договора. */
    const hostile = '<script>alert(1)</script>\n\n[Grohe](https://grohe.com)\n\n![](x.png)';
    const blocks = parseSimpleMarkdown(hostile);
    assert.ok(blocks.every((b) => b.kind === "p" || b.kind === "ul"));
    assert.deepEqual(blocks, [
      { kind: "p", text: "<script>alert(1)</script>" },
      { kind: "p", text: "[Grohe](https://grohe.com)" },
      { kind: "p", text: "![](x.png)" },
    ]);
  });
});

describe("stripMarkdown", () => {
  it("склеивает блоки в одну строку", () => {
    assert.equal(
      stripMarkdown("Унитаз-моноблок.\n\n- Дюропласт\n- Душевой смыв"),
      "Унитаз-моноблок. Дюропласт. Душевой смыв",
    );
  });

  it("укладывается в maxLen вместе с многоточием", () => {
    const long = "Унитаз-моноблок Vita Lux с горизонтальным выпуском и сиденьем из дюропласта";
    const out = stripMarkdown(long, 40);
    assert.ok(out.length <= 40, `длина ${out.length} превысила предел`);
    assert.ok(out.endsWith("…"));
  });

  it("режет по границе слова, а не посреди него", () => {
    const src = "Унитаз-моноблок Vita Lux VL-3204 безободковый";
    const out = stripMarkdown(src, 30);
    assert.ok(out.endsWith("…"));

    const body = out.slice(0, -1);
    assert.ok(src.startsWith(body), `«${body}» — не начало исходного текста`);
    /* Место разреза обязано быть концом слова: следующий символ оригинала —
       пробел (или текст кончился). Иначе в выдаче Google висел бы огрызок
       вроде «безобод…», который читается как поломка сайта. */
    const next = src.slice(body.length, body.length + 1);
    assert.ok(next === "" || next === " ", `разрез пришёлся на середину слова, дальше «${next}»`);
  });

  it("короткий текст возвращает как есть, без многоточия", () => {
    assert.equal(stripMarkdown("Биде подвесное", 160), "Биде подвесное");
  });
});
