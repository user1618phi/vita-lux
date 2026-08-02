import type { Checks } from "./readiness";
import { publishable } from "./readiness";

/* Готов товар к публикации или нет.

   Здесь побывали два перебора подряд. Сначала пять квадратиков с буквами
   И · Р · Ф · Ц · О и легендой под таблицей — ребус, который надо было
   расшифровывать. Потом перечисление недостающего словами — читаемо, но в
   каждой строке висело «нет названия, раздела», и колонка из ответа
   превратилась в стену текста.

   В таблице на 91 строку нужен один бит: можно публиковать или нет. Что
   именно не заполнено, человек увидит в карточке товара, когда откроет её
   заполнять, — там это и уместно.

   Причина недоступности всё же не теряется: она остаётся в `title`, поэтому
   доступна по наведению и скринридеру, не занимая места. */

const LABEL: [keyof Checks, string][] = [
  ["name", "название"],
  ["category", "раздел"],
  ["photo", "фото"],
  ["price", "цена"],
];

export function ReadyMarks({ checks }: { checks: Checks }) {
  const ok = publishable(checks);
  const missing = LABEL.filter(([k]) => !checks[k]).map(([, label]) => label);

  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        fontSize: "var(--text-caption)",
        color: ok ? "var(--state-success)" : "var(--text-secondary)",
      }}
      title={ok ? "Можно публиковать" : `Не хватает: ${missing.join(", ")}`}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          background: ok ? "var(--state-success)" : "var(--border-control)",
        }}
      />
      {ok ? "готов" : "не готов"}
    </span>
  );
}
