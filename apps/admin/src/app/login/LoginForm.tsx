"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions";
import { Button, ErrorBox, Field, inputStyle } from "@/app/ui";

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

      <Button type="submit" pending={pending} pendingLabel="Проверяем…" className="mt-1">
        Войти
      </Button>
    </form>
  );
}
