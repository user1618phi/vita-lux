import type { ReactNode } from "react";

/* Таблица.

   В админке её не было вообще: каждая строка списка была карточкой с фото
   56×56, и десять товаров занимали экран. Для 92 позиций, которые нужно
   перебрать и довести до публикации, это неработоспособно.

   Правила плотности:
   — строка 40px, разделители волосяные, зебры нет (полосы спорят с
     подсветкой наведения и мешают вести глаз по строке);
   — числа выравниваются по правому краю и набираются `.vl-mono`, где уже
     включён `tabular-nums`: разряды встают друг под друга, и колонку можно
     сравнивать взглядом, не читая;
   — заголовок липкий, потому что таблица длиннее экрана по определению.

   На телефоне таблица переключается в карточки только для чтения — правило
   из плана: телефон нужен посмотреть, а не редактировать. */

export interface Column<T> {
  key: string;
  header: string;
  /** Числовая колонка: правое выравнивание и моноширинный шрифт. */
  numeric?: boolean;
  /** Ширина, если колонку нельзя отдать на откуп содержимому. */
  width?: number | string;
  /** Скрыть на узких экранах — для второстепенных колонок. */
  secondary?: boolean;
  /** Запретить перенос: статусы, даты, короткие метки. Числа и так не переносятся. */
  nowrap?: boolean;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  footer,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  footer?: ReactNode;
}) {
  if (rows.length === 0 && empty) {
    return (
      <div
        className="rounded-lg"
        style={{ background: "var(--surface-card)", border: "1px solid var(--border)" }}
      >
        {empty}
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-lg"
      style={{ background: "var(--surface-card)", border: "1px solid var(--border)" }}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`sticky top-0 z-10 px-3 py-2 text-left font-normal ${
                    c.secondary ? "hidden lg:table-cell" : ""
                  }`}
                  style={{
                    width: c.width,
                    textAlign: c.numeric ? "right" : "left",
                    fontSize: "var(--text-micro)",
                    letterSpacing: "var(--tracking-label)",
                    textTransform: "uppercase",
                    color: "var(--text-secondary)",
                    background: "var(--surface-card)",
                    borderBottom: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="vl-row">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 ${c.secondary ? "hidden lg:table-cell" : ""} ${
                      c.numeric ? "vl-mono" : ""
                    }`}
                    style={{
                      height: 40,
                      textAlign: c.numeric ? "right" : "left",
                      fontSize: "var(--text-body-s)",
                      color: "var(--text-primary)",
                      borderBottom: "1px solid var(--border)",
                      /* Числа и статусы не переносятся: «184 900 ₸», разорванное
                         на две строки, ломает и высоту строки, и саму цель
                         колонки — сравнивать значения взглядом по вертикали.
                         Тесно станет — таблица уедет в горизонтальный скролл,
                         он для того и есть. */
                      whiteSpace: c.nowrap || c.numeric ? "nowrap" : undefined,
                    }}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer ? (
        <div className="px-3 py-2" style={{ borderTop: "1px solid var(--border)" }}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/* Второстепенный текст внутри ячейки — артикул под названием и т.п. */
export function Muted({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>{children}</span>
  );
}
