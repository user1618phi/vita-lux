"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";
import { ErrorBox, Field, inputStyle } from "../ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null as { error?: string } | null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <ErrorBox>{state?.error}</ErrorBox>

      <Field label="Логин">
        <input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          required
          style={inputStyle}
        />
      </Field>

      <Field label="Пароль">
        <input name="password" type="password" autoComplete="current-password" required style={inputStyle} />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-md font-sans text-[16px]"
        style={{
          height: 52,
          background: "var(--ink)",
          color: "var(--glaze)",
          border: "none",
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? "Проверяем…" : "Войти"}
      </button>
    </form>
  );
}
