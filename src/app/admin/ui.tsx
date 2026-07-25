import type { CSSProperties, ReactNode } from "react";

/* Shared admin primitives. Deliberately plain: the storefront's design system
   is tuned for a shop window, this is a tool used one-handed on a phone in a
   warehouse. Same tokens, bigger targets, no decoration.

   Inputs are 16px per CLAUDE.md — anything smaller makes iOS zoom on focus. */

export const inputStyle: CSSProperties = {
  width: "100%",
  height: 48,
  padding: "0 14px",
  background: "var(--white)",
  border: "1px solid var(--border-control)",
  borderRadius: "var(--radius-md)",
  outline: "none",
  fontFamily: "var(--font-sans)",
  fontSize: 16,
  color: "var(--ink)",
};

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
      <span className="block mb-1.5 font-sans text-[13px] text-slate">{label}</span>
      {children}
      {hint ? <span className="block mt-1 font-sans text-[12px] text-slate">{hint}</span> : null}
    </label>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="m-0 mb-4 rounded-md px-3 py-2.5 font-sans text-[14px]"
      style={{ background: "rgba(179,52,31,0.08)", color: "var(--state-danger)" }}
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
      className="m-0 mb-4 rounded-md px-3 py-2.5 font-sans text-[14px]"
      style={{ background: "rgba(30,107,74,0.10)", color: "var(--state-success)" }}
    >
      {children}
    </p>
  );
}

const STOCK_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  in: { bg: "rgba(30,107,74,0.10)", color: "var(--state-success)", label: "В наличии" },
  order: { bg: "rgba(168,123,65,0.12)", color: "var(--brass-text)", label: "Под заказ" },
  out: { bg: "rgba(179,52,31,0.08)", color: "var(--state-danger)", label: "Нет" },
};

export function StockChip({ state }: { state: string | null }) {
  const s = STOCK_STYLE[state ?? "order"] ?? STOCK_STYLE.order;
  return (
    <span
      className="inline-block rounded-sm px-2 py-0.5 font-sans text-[12px]"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

export function AdminNav({ current }: { current: "products" | "bulk" | "settings" }) {
  const tabs = [
    { key: "products", href: "/admin/products", label: "Товары" },
    { key: "bulk", href: "/admin/bulk", label: "Цены и наличие" },
    { key: "settings", href: "/admin/settings", label: "Настройки" },
  ] as const;

  return (
    <nav className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      {tabs.map((t) => (
        <a
          key={t.key}
          href={t.href}
          className="flex-none rounded-md px-3.5 font-sans text-[14px] leading-[40px]"
          style={{
            background: current === t.key ? "var(--ink)" : "transparent",
            color: current === t.key ? "var(--porcelain)" : "var(--slate)",
            textDecoration: "none",
          }}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}
