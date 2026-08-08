import { parseSimpleMarkdown } from "@vita/core/markdown";

/* Описание товара.

   Серверный компонент: разбор идёт на сервере, а в разметку уходят обычные
   React-узлы. Отсюда главное свойство — `dangerouslySetInnerHTML` здесь нет и
   быть не может, экранирование делает React, и текст из админки не способен
   выполнить скрипт или подсунуть ссылку.

   Грамматика закрыта (абзацы и списки, см. @vita/core/markdown), поэтому набор
   узлов конечен и его не нужно санитайзить отдельно. */

export function ProductDescription({ markdown }: { markdown?: string }) {
  const blocks = parseSimpleMarkdown(markdown);
  if (!blocks.length) return null;

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, i) =>
        block.kind === "p" ? (
          <p key={i} className="m-0 font-sans text-[14px] lg:text-[15px] text-slate leading-[1.6]">
            {block.text}
          </p>
        ) : (
          <ul key={i} className="m-0 pl-5 flex flex-col gap-1.5 list-disc marker:text-brass">
            {block.items.map((item, j) => (
              <li key={j} className="font-sans text-[14px] lg:text-[15px] text-slate leading-[1.6]">
                {item}
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
