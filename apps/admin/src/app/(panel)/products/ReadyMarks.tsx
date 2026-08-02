import type { Checks } from "./readiness";
import { publishable } from "./readiness";

/* Чего не хватает товару, чтобы выйти на сайт.

   Здесь были пять квадратиков с буквами И · Р · Ф · Ц · О и легенда под
   таблицей. Компактно, но нечитаемо: чтобы понять строку, приходилось искать
   расшифровку внизу и держать её в голове. Колонка, которая требует легенды,
   свою работу не делает.

   Теперь пишется прямо то, что нужно сделать: «нет фото, цены». Название
   требования и есть действие, расшифровывать нечего. Готовый товар говорит
   «готов», и это единственное состояние, которое можно опознать одним взглядом
   по цвету, — остальные надо читать, и это правильно, потому что они разные.

   Порядок слов не алфавитный, а по трудозатратам: название и раздел пишет
   человек, фото и цену обычно приносит X2pos. Сначала то, что делать руками. */

const MISSING_LABEL: [keyof Checks, string][] = [
  ["name", "названия"],
  ["category", "раздела"],
  ["photo", "фото"],
  ["price", "цены"],
];

export function ReadyMarks({ checks }: { checks: Checks }) {
  if (publishable(checks)) {
    return (
      <span
        className="inline-flex items-center gap-1.5"
        style={{ fontSize: "var(--text-caption)", color: "var(--state-success)" }}
      >
        <span
          aria-hidden="true"
          style={{ width: 6, height: 6, borderRadius: 3, background: "var(--state-success)" }}
        />
        готов
        {/* Остаток к публикации не обязателен — товар под заказ продавать
            законно, — но знать о нём полезно, поэтому он в примечании. */}
        {!checks.stock ? (
          <span style={{ color: "var(--text-secondary)" }}>· нет на складе</span>
        ) : null}
      </span>
    );
  }

  const missing = MISSING_LABEL.filter(([k]) => !checks[k]).map(([, label]) => label);

  return (
    <span style={{ fontSize: "var(--text-caption)", color: "var(--brass-text)" }}>
      нет {missing.join(", ")}
    </span>
  );
}
