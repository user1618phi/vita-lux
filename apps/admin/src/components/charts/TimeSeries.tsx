"use client";

import { useState } from "react";
import { formatTenge } from "@vita/core/format";

/* Продажи по неделям: две серии, сайт и магазин.

   Ровно две, и это не случайность. Категориальных ячеек в системе две
   (`--chart-site` / `--chart-store`), они посчитаны валидатором и проходят
   проверку на цветовую слепоту с запасом. Третьей серии здесь не появится:
   она либо сложится в «прочее», либо станет отдельным графиком.

   Одна ось Y на обе серии — обе меряют тенге. Вторая ось справа с другим
   масштабом даёт две линии, которые визуально пересекаются там, где в данных
   ничего не происходит; это самая частая ошибка в графиках, и её здесь нет.

   Наведение обязательно: график в вебе интерактивен по своей природе, и без
   подсказки точные значения приходится угадывать по сетке. Вертикальная
   направляющая ловит ближайшую неделю по X — попадать курсором в точку
   диаметром 8px не нужно.

   Легенда есть всегда, плюс подписи серий на последних точках: цвет — не
   единственный носитель различия. */

export interface SeriesPoint {
  /** Подпись по X: «14 июл». */
  label: string;
  site: number;
  store: number;
}

const PAD = { top: 12, right: 12, bottom: 22, left: 52 };
const H = 220;

export function TimeSeries({
  data,
  emptyLabel = "Нет продаж за период",
}: {
  data: SeriesPoint[];
  emptyLabel?: string;
}) {
  /* Форматирование живёт здесь, а не приходит пропом: функцию нельзя передать
     из серверного компонента в клиентский, а `formatTenge` — чистая и в
     браузерный бандл тянет только себя. */
  const [active, setActive] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <p className="m-0 px-4 py-10 text-center" style={{ color: "var(--text-secondary)" }}>
        {emptyLabel}
      </p>
    );
  }

  const W = 720; // viewBox; SVG тянется по ширине контейнера
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const max = Math.max(...data.flatMap((d) => [d.site, d.store]), 1);
  /* Округляем потолок вверх до «круглого», чтобы подписи оси были читаемыми. */
  const ceil = niceCeil(max);

  const x = (i: number) => PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / ceil) * innerH;

  const line = (key: "site" | "store") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");

  const ticks = [0, ceil / 2, ceil];
  const point = active === null ? null : data[active];

  return (
    <div className="px-4 pb-3 pt-1">
      <Legend />

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          role="img"
          aria-label="Продажи по неделям: сайт и магазин"
          onMouseLeave={() => setActive(null)}
        >
          {/* Сетка — вспомогательная, тоньше и светлее марок. */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--chart-grid)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(t) + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--text-secondary)"
                className="vl-mono"
              >
                {shortMoney(t)}
              </text>
            </g>
          ))}

          {/* Направляющая под курсором — рисуется первой, чтобы линии легли поверх. */}
          {active !== null ? (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="var(--border-control)"
              strokeWidth={1}
            />
          ) : null}

          <path d={line("store")} fill="none" stroke="var(--chart-store)" strokeWidth={2} strokeLinejoin="round" />
          <path d={line("site")} fill="none" stroke="var(--chart-site)" strokeWidth={2} strokeLinejoin="round" />

          {/* Точка под курсором. Кольцо цветом поверхности отделяет марку от линии. */}
          {active !== null && point
            ? (["store", "site"] as const).map((k) => (
                <circle
                  key={k}
                  cx={x(active)}
                  cy={y(point[k])}
                  r={4}
                  fill={k === "site" ? "var(--chart-site)" : "var(--chart-store)"}
                  stroke="var(--surface-card)"
                  strokeWidth={2}
                />
              ))
            : null}

          {/* Подписи по X: только края и середина, иначе они наедут друг на друга. */}
          {data.map((d, i) =>
            i === 0 || i === data.length - 1 || i === Math.floor((data.length - 1) / 2) ? (
              <text
                key={d.label}
                x={x(i)}
                y={H - 6}
                textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                fontSize={11}
                fill="var(--text-secondary)"
              >
                {d.label}
              </text>
            ) : null,
          )}

          {/* Зоны захвата шире марок: попасть в 8px точку мышью тяжело. */}
          {data.map((d, i) => (
            <rect
              key={`hit-${d.label}`}
              x={x(i) - innerW / Math.max(data.length, 1) / 2}
              y={PAD.top}
              width={innerW / Math.max(data.length, 1)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setActive(i)}
            />
          ))}
        </svg>

        {point ? (
          <div
            className="pointer-events-none absolute top-0 rounded-md px-3 py-2"
            style={{
              left: `${(x(active!) / W) * 100}%`,
              transform: "translateX(-50%)",
              background: "var(--surface-card)",
              border: "1px solid var(--border-control)",
              fontSize: "var(--text-caption)",
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ color: "var(--text-secondary)" }}>{point.label}</div>
            <div className="vl-mono mt-1" style={{ color: "var(--text-primary)" }}>
              Сайт {formatTenge(point.site)}
            </div>
            <div className="vl-mono" style={{ color: "var(--text-primary)" }}>
              Магазин {formatTenge(point.store)}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="mb-1 flex flex-wrap items-center gap-4">
      <LegendItem color="var(--chart-site)" label="Сайт" />
      <LegendItem color="var(--chart-store)" label="Магазин" />
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5" style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
      <span aria-hidden="true" style={{ width: 12, height: 2, background: color, borderRadius: 1 }} />
      {label}
    </span>
  );
}

/* Потолок оси до «круглого» числа — иначе подписи вида 4 218 731 нечитаемы. */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag) * mag;
}

function shortMoney(v: number): string {
  if (v === 0) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}М`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}т`;
  return String(Math.round(v));
}
