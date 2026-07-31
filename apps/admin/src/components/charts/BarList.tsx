"use client";

import { useState } from "react";

/* Рейтинг: горизонтальные полосы.

   Форма выбрана под задачу «кто больше»: названия товаров и клиентов длинные,
   и в вертикальных столбцах подписи пришлось бы класть боком. Горизонтальные
   полосы читаются как список, а список — это и есть рейтинг.

   Одна серия, поэтому легенды нет: заголовок графика уже говорит, что за
   величина. Значения подписаны прямо у полос — при десяти строках это ещё не
   шум, а ось X становится не нужна совсем.

   Полосы одного цвета намеренно. Красить каждую строку в свой оттенок значит
   кодировать цветом ранг, а ранг уже закодирован длиной и порядком; такая
   раскраска только съедает категориальную палитру, которой в системе всего
   две ячейки. */

export interface BarDatum {
  id: string;
  label: string;
  value: number;
  /** Что показать вместо числа: «1 668 021 ₸». */
  display: string;
  /** Вторая строка под названием — артикул, город. */
  sub?: string;
}

export function BarList({
  data,
  tone = "site",
  emptyLabel = "Нет данных",
}: {
  data: BarDatum[];
  tone?: "site" | "store" | "danger";
  emptyLabel?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <p className="m-0 px-4 py-8 text-center" style={{ color: "var(--text-secondary)" }}>
        {emptyLabel}
      </p>
    );
  }

  const color =
    tone === "danger" ? "var(--state-danger)" : tone === "store" ? "var(--chart-store)" : "var(--chart-site)";
  /* Масштаб от максимума, а не от суммы: сравниваются строки между собой. */
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);

  return (
    <ul className="m-0 list-none p-0">
      {data.map((d) => {
        const pct = (Math.abs(d.value) / max) * 100;
        const on = hover === d.id;
        return (
          <li
            key={d.id}
            className="px-4 py-2"
            onMouseEnter={() => setHover(d.id)}
            onMouseLeave={() => setHover(null)}
            style={{ background: on ? "var(--surface-control)" : "transparent" }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate" style={{ fontSize: "var(--text-body-s)", color: "var(--text-primary)" }}>
                {d.label}
                {d.sub ? (
                  <span style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
                    {" · "}
                    {d.sub}
                  </span>
                ) : null}
              </span>
              {/* Значение — текстовым токеном, не цветом серии: цвет несёт
                  полоса рядом, а число должно читаться как текст. */}
              <span
                className="vl-mono shrink-0"
                style={{ fontSize: "var(--text-body-s)", color: "var(--text-primary)" }}
              >
                {d.display}
              </span>
            </div>
            {/* Полоса 6px с закруглённым концом, прижата к нулю слева. */}
            <div className="mt-1.5 h-1.5 w-full" style={{ background: "var(--chart-grid)", borderRadius: 3 }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: color,
                  borderRadius: 3,
                  transition: "width var(--transition)",
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
