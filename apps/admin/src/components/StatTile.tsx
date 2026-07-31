import type { ReactNode } from "react";

/* Показатель с мерной линейкой.

   Подпись этой панели. На витрине есть `DimensionLine` — тонкая латунная
   линия с засечками и моноширинной подписью, которой размечают габарит
   раковины. Здесь тот же приём размечает не сантиметры, а долю: под цифрой
   идёт волосяная линейка, на ней засечка, и сразу видно, где значение стоит
   внутри целого — сколько из выручки не получено, сколько товаров готово к
   продаже, сколько долга приходится на одного клиента.

   Смысл в том, что доля читается без второго числа и без круговой диаграммы.
   Один приём на всю панель — этого хватает, чтобы она выглядела сделанной, а
   не собранной из чужих карточек.

   Ноль — это тоже значение. `value` не прячется и не заменяется прочерком:
   «продажи сайта 0 ₸» — важный факт, а не отсутствие данных. Для настоящего
   отсутствия есть `unavailable`. */

export interface StatTileProps {
  label: string;
  /** Уже отформатированное значение. Форматирование денег — не дело плитки. */
  value: string;
  /** Подпись под линейкой: что означает засечка. */
  caption?: string;
  /** Доля 0…1. Задана — рисуется линейка с засечкой. */
  fraction?: number;
  /** Цвет засечки. По умолчанию латунь. */
  tone?: "brass" | "success" | "danger" | "site" | "store";
  /** Данные не получены — X2pos недоступен. Не то же самое, что ноль. */
  unavailable?: boolean;
  action?: ReactNode;
}

const TONE: Record<NonNullable<StatTileProps["tone"]>, string> = {
  brass: "var(--brass)",
  success: "var(--state-success)",
  danger: "var(--state-danger)",
  site: "var(--chart-site)",
  store: "var(--chart-store)",
};

export function StatTile({
  label,
  value,
  caption,
  fraction,
  tone = "brass",
  unavailable = false,
  action,
}: StatTileProps) {
  const color = TONE[tone];
  const clamped =
    fraction === undefined ? null : Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));

  return (
    <div
      className="min-w-0 rounded-lg px-4 py-4"
      style={{ background: "var(--surface-card)", border: "1px solid var(--border)" }}
    >
      <div
        className="truncate"
        style={{
          fontSize: "var(--text-micro)",
          letterSpacing: "var(--tracking-label)",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
        }}
      >
        {label}
      </div>

      <div
        className="vl-mono mt-2 truncate"
        style={{
          fontSize: "var(--text-display-m)",
          lineHeight: 1.05,
          fontWeight: "var(--weight-medium)",
          color: unavailable ? "var(--text-secondary)" : "var(--text-primary)",
        }}
      >
        {unavailable ? "—" : value}
      </div>

      {/* Мерная линейка. Рисуется только когда доля осмысленна: без неё
          плитка остаётся просто числом, и это нормально. */}
      {clamped !== null && !unavailable ? <MeasureRule fraction={clamped} color={color} /> : null}

      {caption ? (
        <div
          className="mt-2"
          style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}
        >
          {unavailable ? "данные из X2pos не получены" : caption}
        </div>
      ) : null}

      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/* Линейка: волосяная ось с концевыми засечками и одной подвижной меткой.

   `aria-hidden`, потому что доля уже сказана словами в `caption` — иначе
   скринридер прочитает украшение и повторит смысл дважды. */
function MeasureRule({ fraction, color }: { fraction: number; color: string }) {
  const pct = fraction * 100;
  return (
    <div className="relative mt-3 h-[9px]" aria-hidden="true">
      {/* ось */}
      <div
        className="absolute left-0 right-0"
        style={{ top: 4, height: 1, background: "var(--border-control)" }}
      />
      {/* концевые засечки — они и делают линию «мерной», а не progress-баром */}
      <div className="absolute left-0" style={{ top: 0, width: 1, height: 9, background: "var(--border-control)" }} />
      <div className="absolute right-0" style={{ top: 0, width: 1, height: 9, background: "var(--border-control)" }} />
      {/* пройденный отрезок */}
      <div className="absolute left-0" style={{ top: 4, height: 1, width: `${pct}%`, background: color }} />
      {/* метка значения */}
      <div
        className="absolute"
        style={{
          top: 0,
          left: `${pct}%`,
          transform: "translateX(-50%)",
          width: 2,
          height: 9,
          background: color,
        }}
      />
    </div>
  );
}

/* Ряд плиток. Четыре в ряд на ПК, две на планшете, одна на телефоне. */
export function StatRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}
