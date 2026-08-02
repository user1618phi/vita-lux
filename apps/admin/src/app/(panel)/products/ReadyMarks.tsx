import type { Checks } from "./readiness";

/* Что мешает опубликовать товар — пятью отметками в одной ячейке.

   Компактнее любого текста и читается сканированием: глаз ищет незакрытые
   позиции по колонке, а не перечитывает строки. Буква — не украшение, а
   первая буква требования, и подпись `title` называет его целиком, поэтому
   смысл не держится на одном цвете. */

const LABEL: Record<keyof Checks, [string, string]> = {
  name: ["И", "название для витрины"],
  category: ["Р", "раздел каталога"],
  photo: ["Ф", "фотография"],
  price: ["Ц", "цена"],
  stock: ["О", "остаток на складе"],
};

export function ReadyMarks({ checks }: { checks: Checks }) {
  return (
    <span className="inline-flex gap-1">
      {(Object.keys(LABEL) as (keyof Checks)[]).map((k) => {
        const ok = checks[k];
        const [letter, title] = LABEL[k];
        return (
          <span
            key={k}
            title={`${title}: ${ok ? "есть" : "нет"}`}
            className="inline-flex h-5 w-5 items-center justify-center rounded-sm"
            style={{
              fontSize: "var(--text-micro)",
              background: ok ? "var(--tint-success)" : "var(--surface-control)",
              color: ok ? "var(--state-success)" : "var(--text-secondary)",
              border: `1px solid ${ok ? "var(--tint-success-border)" : "var(--border-control)"}`,
            }}
          >
            {letter}
          </span>
        );
      })}
    </span>
  );
}
