"use client";

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

/* Двухшаговое подтверждение необратимого действия.

   Первое нажатие не отправляет форму — оно превращает кнопку в вопрос.
   Второе отправляет. Рядом появляется «Отмена».

   Почему не `window.confirm`: системный диалог нельзя оформить, он выглядит
   чужеродно, на телефоне его кнопки стоят у края экрана (легко промахнуться),
   а в некоторых webview он подавляется вовсе — и тогда подтверждения не будет
   совсем, а действие выполнится.

   Через 5 секунд бездействия кнопка возвращается в исходное состояние: иначе
   на экране остаётся взведённое опасное действие, о котором пользователь забыл. */

const ARMED_TIMEOUT_MS = 5000;

export function ConfirmButtonClient({
  confirmLabel,
  children,
  ...rest
}: {
  confirmLabel: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style" | "children">) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!armed) return;
    timer.current = setTimeout(() => setArmed(false), ARMED_TIMEOUT_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [armed]);

  if (!armed) {
    return (
      <button
        {...rest}
        type="button"
        onClick={() => setArmed(true)}
        className={`rounded-md font-sans ${rest.className ?? ""}`}
        style={{
          minHeight: 44,
          padding: "0 12px",
          fontSize: "var(--text-body-s)",
          background: "var(--surface-card)",
          border: "1px solid var(--border-control)",
          color: "var(--state-danger)",
          cursor: "pointer",
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {/* type="submit" — второе нажатие уже отправляет форму */}
      <button
        {...rest}
        type="submit"
        className={`rounded-md font-sans ${rest.className ?? ""}`}
        style={{
          minHeight: 44,
          padding: "0 12px",
          fontSize: "var(--text-body-s)",
          background: "var(--tint-danger)",
          border: "1px solid var(--state-danger)",
          color: "var(--state-danger)",
          cursor: "pointer",
        }}
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="rounded-md font-sans"
        style={{
          minHeight: 44,
          padding: "0 12px",
          fontSize: "var(--text-body-s)",
          background: "transparent",
          border: "none",
          color: "var(--text-secondary)",
          cursor: "pointer",
        }}
      >
        Отмена
      </button>
    </span>
  );
}
