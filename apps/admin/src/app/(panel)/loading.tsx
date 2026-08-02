/* Заглушка на время загрузки экрана.

   Лежит ВНУТРИ группы `(panel)`, поэтому подменяет только контент: меню
   рисуется layout'ом группы и на месте остаётся. Раньше этот файл был в корне
   приложения и заменял собой всю страницу целиком — вместе с меню, отчего при
   каждом переходе панель на секунду превращалась в пустой экран с одним
   словом «Загружаем…».

   Форма повторяет обычный экран: полоса заголовка и четыре плитки. Так переход
   не дёргает вёрстку — блоки стоят там же, где встанет настоящее содержимое. */

export default function PanelLoading() {
  return (
    <>
      <header
        className="px-4 py-5 md:px-8 md:py-6"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <Bar width={180} height={22} />
        <div className="mt-2">
          <Bar width={320} height={14} />
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 md:px-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg px-4 py-4"
              style={{ background: "var(--surface-card)", border: "1px solid var(--border)" }}
            >
              <Bar width={110} height={11} />
              <div className="mt-3">
                <Bar width={160} height={28} />
              </div>
              <div className="mt-3">
                <Bar width="100%" height={9} />
              </div>
            </div>
          ))}
        </div>

        <div
          className="mt-6 rounded-lg"
          style={{ background: "var(--surface-card)", border: "1px solid var(--border)", height: 260 }}
        />

        {/* Текст для скринридера: он не видит серых прямоугольников. */}
        <p className="sr-only" aria-live="polite">
          Загружаем…
        </p>
      </div>
    </>
  );
}

/* Один серый прямоугольник. Без анимации: мигающие скелеты на плотной панели
   создают рябь, а страница и так появляется за доли секунды. */
function Bar({ width, height }: { width: number | string; height: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: "var(--radius-sm)",
        background: "var(--surface-control)",
      }}
    />
  );
}
