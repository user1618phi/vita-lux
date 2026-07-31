import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { can, type AdminRole } from "@vita/core/permissions";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@vita/core/order/labels";
import { ConfirmButtonClient } from "./ConfirmButton";

/* Shared admin primitives. Deliberately plain: the storefront's design system
   is tuned for a shop window, this is a tool used one-handed on a phone in a
   warehouse. Same tokens, bigger targets, no decoration.

   Inputs are 16px per CLAUDE.md — anything smaller makes iOS zoom on focus. */

export const inputStyle: CSSProperties = {
  width: "100%",
  height: 48,
  padding: "0 14px",
  /* Роли, а не примитивы. `--surface-control` — это «заливка поля ввода»,
     `--text-primary` — «основной текст». Раньше здесь стояли `--white` и
     `--ink`: они дают тот же цвет, но описывают не роль, а конкретный оттенок,
     и в тёмной теме держатся правильно только по совпадению. */
  background: "var(--surface-control)",
  border: "1px solid var(--border-control)",
  borderRadius: "var(--radius-md)",
  outline: "none",
  fontFamily: "var(--font-sans)",
  fontSize: 16,
  color: "var(--text-primary)",
};

/* ── Кнопка ────────────────────────────────────────────────────────────────

   Один примитив вместо четырёх копий. До него стиль первичной кнопки был
   дословно повторён в LoginForm, ProductForm, BulkForm и SettingsForm, и во
   всех четырёх — с `background: var(--ink)` и `color: var(--glaze)`.

   Это работало по совпадению: `--glaze` описывает ПОВЕРХНОСТЬ, которая ложится
   на ink, а не подпись на кнопке. Пара инвертируется в тёмной теме вместе,
   поэтому глаз ошибки не видел. Но в день, когда `--glaze` подвинут по причине
   поверхности, все первичные кнопки админки потеряют читаемую подпись.
   Для этой роли есть `--action-primary-bg` / `--action-primary-text`, и
   CLAUDE.md требует именно их. */

type ButtonVariant = "primary" | "secondary" | "danger";

const BUTTON_VARIANT: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "var(--action-primary-bg)",
    color: "var(--action-primary-text)",
    border: "none",
  },
  secondary: {
    background: "var(--surface-card)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-control)",
  },
  danger: {
    background: "var(--tint-danger)",
    color: "var(--state-danger)",
    border: "1px solid var(--state-danger)",
  },
};

export function Button({
  variant = "primary",
  pending = false,
  pendingLabel,
  fullWidth = true,
  size = "md",
  children,
  ...rest
}: {
  variant?: ButtonVariant;
  pending?: boolean;
  pendingLabel?: string;
  fullWidth?: boolean;
  size?: "sm" | "md";
  children: ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style" | "children">) {
  /* Высота не опускается ниже 44px даже у size="sm": это нижняя граница
     комфортного тач-таргета, а инструментом пользуются одной рукой на складе. */
  const height = size === "sm" ? 44 : 52;
  return (
    <button
      {...rest}
      disabled={pending || rest.disabled}
      className={`rounded-md font-sans ${fullWidth ? "w-full" : ""} ${rest.className ?? ""}`}
      style={{
        height,
        fontSize: size === "sm" ? "var(--text-body-s)" : "var(--text-body)",
        cursor: pending ? "default" : "pointer",
        opacity: pending ? 0.6 : 1,
        ...BUTTON_VARIANT[variant],
      }}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="block mb-1.5 font-sans"
        style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}
      >
        {label}
      </span>
      {children}
      {hint ? (
        <span
          className="block mt-1 font-sans"
          style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}

/* ── Каркас страницы ───────────────────────────────────────────────────────

   Шесть экранов собирали <main> вручную, и нижний отступ успел разъехаться:
   pb-24 на списке товаров, ничего в /bulk, pb-16 в остальных. Разница ничем не
   обоснована — это не система, а следы копирования.

   `width` — не про красоту, а про содержимое: списку нужна широкая колонка,
   форме узкая, иначе строка ввода растягивается на весь экран ноутбука и
   читать её тяжело. */
export function PageShell({
  title,
  aside,
  nav,
  width = "narrow",
  children,
}: {
  title: string;
  aside?: ReactNode;
  nav?: ReactNode;
  width?: "narrow" | "wide";
  children: ReactNode;
}) {
  return (
    <main
      className={`mx-auto w-full px-4 py-5 pb-24 ${width === "wide" ? "max-w-[900px] lg:max-w-[1100px]" : "max-w-[640px]"}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1
          className="m-0 font-display"
          style={{ fontSize: "var(--text-title)", color: "var(--text-primary)" }}
        >
          {title}
        </h1>
        {aside}
      </header>
      {nav}
      {children}
    </main>
  );
}

/* ── Подтверждение необратимого действия ───────────────────────────────────

   Двухшаговая кнопка, а не `window.confirm`: системный диалог нестилизуем, на
   iOS в него легко промахнуться, и он блокирует поток. Здесь подтверждение
   появляется ровно там, где палец уже находится.

   До этого удаление фото было кнопкой 26×26 в углу миниатюры, которая
   безвозвратно сносила и строку в БД, и оба объекта в хранилище — без вопроса
   и без отмены. */
export function ConfirmButton({
  confirmLabel = "Точно удалить?",
  children,
  ...rest
}: {
  confirmLabel?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style" | "children">) {
  return (
    <ConfirmButtonClient confirmLabel={confirmLabel} {...rest}>
      {children}
    </ConfirmButtonClient>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="m-0 mb-4 rounded-md px-3 py-2.5 font-sans text-[length:var(--text-body-s)]"
      style={{ background: "var(--tint-danger)", color: "var(--state-danger)" }}
    >
      {children}
    </p>
  );
}

export function OkBox({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="status"
      className="m-0 mb-4 rounded-md px-3 py-2.5 font-sans text-[length:var(--text-body-s)]"
      style={{ background: "var(--tint-success)", color: "var(--state-success)" }}
    >
      {children}
    </p>
  );
}

/* Результат сохранения — с честным ответом на вопрос «а сайт-то обновился?».

   Витрина живёт в другом деплойменте Vercel, и сброс её кэша едет туда
   HTTP-запросом, который может не дойти. До появления этого компонента формы
   печатали «Сайт обновится сразу» безусловно — в том числе когда обновление не
   уезжало вообще никуда.

   Три состояния, а не два: успех с публикацией, успех без неё, и «вопрос не
   поднимался» (published === undefined). */
export function SaveNotice({
  ok,
  published,
  children,
}: {
  ok?: boolean;
  published?: boolean;
  children: ReactNode;
}) {
  if (!ok) return null;
  if (published === false) {
    return (
      <p
        role="status"
        className="m-0 mb-4 rounded-md px-3 py-2.5 font-sans text-[length:var(--text-body-s)]"
        style={{ background: "var(--tint-brass)", color: "var(--brass-text)" }}
      >
        {children} Сайт обновить не удалось — изменения появятся в течение пяти минут.
      </p>
    );
  }
  return <OkBox>{children}{published ? " Сайт обновлён." : ""}</OkBox>;
}

const STOCK_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  in: { bg: "var(--tint-success)", color: "var(--state-success)", label: "В наличии" },
  order: { bg: "var(--tint-brass)", color: "var(--brass-text)", label: "Под заказ" },
  out: { bg: "var(--tint-danger)", color: "var(--state-danger)", label: "Нет" },
};

/* Цвет несёт смысл: «новый» просит внимания (латунь), «выполнен» спокоен
   (зелёный), «отменён» приглушён. Подписи — из домена, чтобы не разойтись с
   Telegram-уведомлением витрины. */
const ORDER_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  new: { bg: "var(--tint-brass)", color: "var(--brass-text)" },
  confirmed: { bg: "var(--tint-success)", color: "var(--state-success)" },
  shipped: { bg: "var(--tint-success)", color: "var(--state-success)" },
  done: { bg: "var(--surface-control)", color: "var(--text-secondary)" },
  cancelled: { bg: "var(--tint-danger)", color: "var(--state-danger)" },
};

export function OrderStatusChip({ status }: { status: string }) {
  const s = ORDER_STATUS_STYLE[status] ?? ORDER_STATUS_STYLE.done;
  return (
    <span
      className="inline-block rounded-sm px-2 py-0.5 font-sans"
      style={{ fontSize: "var(--text-caption)", background: s.bg, color: s.color }}
    >
      {ORDER_STATUS_LABEL[status as OrderStatus] ?? status}
    </span>
  );
}

export function StockChip({ state }: { state: string | null }) {
  const s = STOCK_STYLE[state ?? "order"] ?? STOCK_STYLE.order;
  return (
    <span
      className="inline-block rounded-sm px-2 py-0.5 font-sans text-[length:var(--text-caption)]"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

/* Навигация плюс личный блок: кто вошёл и кнопка выхода.

   Раньше «Выйти» и строка «логин · роль» жили в разметке ОДНОГО экрана
   (списка товаров). На /bulk, /settings и в карточке товара выйти было нельзя
   вообще — приходилось возвращаться на список. Здесь они появляются на каждом
   экране, потому что навигация есть на каждом. */
export function AdminNav({
  current,
  role = "owner",
  username,
  logoutAction,
}: {
  current: "products" | "bulk" | "settings" | "orders" | "account" | "accounts" | "x2pos";
  role?: AdminRole;
  username?: string;
  logoutAction?: () => void | Promise<void>;
}) {
  const tabs = (
    [
      /* Заказы первыми: это ежедневная работа, а товары правят реже.
         Видны обеим ролям — звонит покупателю именно менеджер. */
      { key: "orders", href: "/orders", label: "Заказы" },
      { key: "products", href: "/products", label: "Товары" },
      { key: "bulk", href: "/bulk", label: "Цены и наличие" },
      /* Синхронизация со складом — владельцу: там видны цены закупа и решения
         о наценке, а не только карточки товаров. */
      { key: "x2pos", href: "/x2pos", label: "Склад X2pos", capability: "settings" as const },
      { key: "settings", href: "/settings", label: "Настройки", capability: "settings" as const },
      { key: "accounts", href: "/accounts", label: "Доступ", capability: "accounts" as const },
      { key: "account", href: "/account", label: "Профиль" },
    ] as const
  ).filter((t) => !("capability" in t) || can(role, t.capability));

  return (
    <div className="mt-3 mb-4 flex flex-wrap items-center justify-between gap-2">
      <nav className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {tabs.map((t) => (
          <a
            key={t.key}
            href={t.href}
            className="flex-none rounded-md px-3.5 font-sans leading-[44px]"
            style={{
              fontSize: "var(--text-body-s)",
              background: current === t.key ? "var(--action-primary-bg)" : "transparent",
              color: current === t.key ? "var(--action-primary-text)" : "var(--text-secondary)",
              textDecoration: "none",
            }}
          >
            {t.label}
          </a>
        ))}
      </nav>

      {username ? (
        <div className="flex items-center gap-2">
          <span className="font-sans" style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}>
            {username} · {role === "owner" ? "владелец" : "менеджер"}
          </span>
          {logoutAction ? (
            <form action={logoutAction}>
              <Button type="submit" variant="secondary" size="sm" fullWidth={false}>
                Выйти
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
