import type { ReactNode } from "react";

/* Заголовок экрана.

   Меню отсюда ушло в `PanelChrome`, который рисуется из layout группы
   `(panel)`. Причина: layout переживает переход между страницами, а страница —
   нет, и меню исчезало на всё время загрузки данных. Здесь остался только
   заголовок конкретного экрана — он и должен меняться при навигации. */

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  /* Одна строка под заголовком: что именно на экране и за какой период. Не
     украшение — без неё цифры на Сводке приходится расшифровывать догадками. */
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <header
        className="flex flex-wrap items-end justify-between gap-3 px-4 py-5 md:px-8 md:py-6"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="min-w-0">
          <h1
            className="m-0 font-display"
            style={{ fontSize: "var(--text-title)", color: "var(--text-primary)" }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              className="mt-1 mb-0"
              style={{ fontSize: "var(--text-body-s)", color: "var(--text-secondary)" }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>

      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 pb-24 md:px-8">{children}</div>
    </>
  );
}

/* Раздел внутри экрана. Заголовок + пояснение, потому что почти каждая цифра
   в этой панели требует одной строки о том, откуда она взялась. */
export function Section({
  title,
  hint,
  actions,
  children,
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-6 first:mt-0">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            className="m-0 font-display"
            style={{ fontSize: "var(--text-body-l)", color: "var(--text-primary)" }}
          >
            {title}
          </h2>
          {hint ? (
            <p
              className="mt-1 mb-0"
              style={{ fontSize: "var(--text-body-s)", color: "var(--text-secondary)" }}
            >
              {hint}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

/* Панель — поверхность под таблицу или график. Рамка волосяная, тени нет:
   в системе вообще нет теней, кроме латунного фокус-ринга. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg ${className}`}
      style={{ background: "var(--surface-card)", border: "1px solid var(--border)" }}
    >
      {children}
    </div>
  );
}

/* Пустое состояние. Отдельный компонент, потому что в этой панели пустота —
   норма: сайт ещё не продавал, и половина экранов честно пуста. Пустой экран
   обязан объяснить, что это не поломка, и звать к следующему действию. */
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="m-0" style={{ color: "var(--text-primary)" }}>
        {title}
      </p>
      {hint ? (
        <p
          className="mx-auto mt-1 mb-0 max-w-[420px]"
          style={{ fontSize: "var(--text-body-s)", color: "var(--text-secondary)" }}
        >
          {hint}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
