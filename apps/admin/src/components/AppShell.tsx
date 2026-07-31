import type { ReactNode } from "react";
import { logoutAction } from "@/app/actions";
import { currentAdmin } from "@/lib/auth";
import { NavLink } from "./NavLink";

/* Каркас админки.

   Панель управления складом — это не витрина. Витрина уговаривает, здесь же
   человек сверяет строки и суммы, поэтому всё подчинено плотности: узкое
   постоянное меню слева, широкое поле справа, никаких карточек вокруг каждой
   строки.

   Меню на `next/link`, а не на `<a>`: раньше каждое переключение вкладки было
   полной перезагрузкой документа, а страницы админки — `force-dynamic` поверх
   сетевого Postgres. Отсюда и `loading.tsx` с текстом «Загружаем…»: он
   закрывал несколько секунд белизны, которых теперь просто нет. */

const NAV = [
  { href: "/", label: "Сводка" },
  { href: "/products", label: "Товары" },
  { href: "/orders", label: "Заказы" },
  { href: "/warehouse", label: "Склад" },
  { href: "/sync", label: "Обмен" },
] as const;

const NAV_SECONDARY = [
  { href: "/settings", label: "Настройки" },
  { href: "/account", label: "Профиль" },
] as const;

export async function AppShell({
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
  /* Кто вошёл, каркас выясняет сам. Раньше имя прокидывала каждая страница, и
     добавить что-то в подвал меню значило пройти по всем экранам разом. */
  const admin = await currentAdmin();
  const username = admin?.username;

  return (
    <div className="min-h-dvh md:flex">
      {/* Меню. На ПК — колонка слева, на телефоне — полоса сверху: телефон
          нужен посмотреть, а не редактировать, и отдавать ему треть экрана
          под навигацию незачем. */}
      <nav
        className="shrink-0 md:sticky md:top-0 md:h-dvh md:w-[220px] md:border-r md:border-b-0 border-b"
        style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
      >
        <div className="flex items-center gap-2 px-4 py-4 md:py-5">
          <span
            className="font-display"
            style={{
              fontSize: "var(--text-body-l)",
              letterSpacing: "0.14em",
              color: "var(--text-primary)",
            }}
          >
            VITA&nbsp;LUX
          </span>
        </div>

        <div className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
          <div
            className="my-2 hidden md:block"
            style={{ borderTop: "1px solid var(--border)" }}
          />
          {NAV_SECONDARY.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </div>

        {username ? (
          <div
            className="mt-auto hidden px-4 py-4 md:block"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div
              className="mb-2 truncate"
              style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}
            >
              {username}
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md px-2 py-1"
                style={{
                  fontSize: "var(--text-micro)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-control)",
                  background: "transparent",
                }}
              >
                Выйти
              </button>
            </form>
          </div>
        ) : null}
      </nav>

      <main className="min-w-0 flex-1">
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
      </main>
    </div>
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
