/* Минимальный markdown для описаний товаров.

   Грамматика закрыта намеренно и состоит из двух правил: пустая строка делит
   абзацы, строка, начинающаяся с «- » или «* », — пункт списка. Ни курсива, ни
   ссылок, ни изображений, ни сырого HTML.

   Почему не react-markdown. Во-первых, парсер отдаёт структуру, а не разметку,
   поэтому компонент рисует обычные React-узлы — экранирование делает сам React,
   и `dangerouslySetInnerHTML` в описании товара не появляется ни при каком
   вводе. Во-вторых, грамматика без ссылок физически не может выпустить <a> на
   чужой бренд: у магазина нет дилерских договоров, и ссылка на Grohe в описании
   — вопрос не вёрстки, а права (см. CLAUDE.md, раздел «Бренд»). В-третьих,
   `stripMarkdown` всё равно нужен для meta-описания и JSON-LD, то есть один
   разбор обслуживает трёх потребителей.

   Следствие, о котором надо знать: `**жирный**` выводится как есть, со
   звёздочками. Описания заводятся через админку и скрипт наполнения, и в них
   инлайновая разметка не используется. Если однажды понадобятся таблицы или
   акценты — react-markdown подставляется за тем же компонентом, вызывающая
   сторона не меняется. */

export type MdBlock = { kind: "p"; text: string } | { kind: "ul"; items: string[] };

const BULLET = /^[-*]\s+(.*)$/;

/** Разбирает текст описания в последовательность абзацев и списков. */
export function parseSimpleMarkdown(src: string | null | undefined): MdBlock[] {
  const blocks: MdBlock[] = [];
  let para: string[] = [];
  let items: string[] = [];

  const flushPara = () => {
    // Одиночные переводы строк внутри абзаца схлопываются в пробел: в textarea
    // админки текст переносят руками, и эти переносы не значат нового абзаца.
    const text = para.join(" ").trim();
    para = [];
    if (text) blocks.push({ kind: "p", text });
  };
  const flushList = () => {
    if (!items.length) return;
    blocks.push({ kind: "ul", items });
    items = [];
  };

  for (const raw of String(src ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushList();
      flushPara();
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      flushPara();
      const item = bullet[1].trim();
      if (item) items.push(item);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushList();
  flushPara();
  return blocks;
}

/** Плоский текст для meta-описания и JSON-LD. `maxLen` — жёсткий предел вместе с многоточием. */
export function stripMarkdown(src: string | null | undefined, maxLen?: number): string {
  const text = parseSimpleMarkdown(src)
    .map((b) => (b.kind === "p" ? b.text : b.items.join(". ")))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!maxLen || text.length <= maxLen) return text;

  /* Режем по границе слова: обрубок посреди слова в сниппете выдачи читается
     как поломка сайта. Если ближайший пробел слишком близко к началу (одно
     длинное слово), режем жёстко — это лучше, чем отдать почти пустую строку. */
  const cut = text.slice(0, maxLen - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const body = lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut;
  return body.replace(/[\s,;:.!?—-]+$/u, "") + "…";
}
