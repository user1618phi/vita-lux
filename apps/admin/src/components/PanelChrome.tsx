import type { ReactNode } from "react";
import { logoutAction } from "@/app/actions";
import { NavLink } from "./NavLink";

/* Постоянная обвязка панели: меню слева, контент справа.

   Отделено от `AppShell` намеренно. Эта часть рендерится один раз в layout и
   при переходах не перерисовывается; `AppShell` — заголовок конкретного
   экрана, он меняется на каждой странице. Если их слить обратно, меню снова
   начнёт мигать при навигации. */

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

export function PanelChrome({ username, children }: { username: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh md:flex">
      <nav
        className="shrink-0 border-b md:sticky md:top-0 md:flex md:h-dvh md:w-[220px] md:flex-col md:border-r md:border-b-0"
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
          <div className="my-2 hidden md:block" style={{ borderTop: "1px solid var(--border)" }} />
          {NAV_SECONDARY.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </div>

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
      </nav>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
