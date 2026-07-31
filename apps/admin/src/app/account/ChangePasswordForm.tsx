"use client";

import { useActionState } from "react";
import { changePasswordAction } from "./actions";
import { Button, ErrorBox, Field, OkBox, inputStyle } from "../ui";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(
    changePasswordAction,
    null as { ok?: boolean; error?: string } | null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <ErrorBox>{state?.error}</ErrorBox>
      {state?.ok ? <OkBox>Пароль изменён. Остальные входы закрыты.</OkBox> : null}

      <Field label="Текущий пароль">
        <input name="current" type="password" autoComplete="current-password" required style={inputStyle} />
      </Field>

      <Field label="Новый пароль" hint="Минимум 12 символов">
        <input name="next" type="password" autoComplete="new-password" required minLength={12} style={inputStyle} />
      </Field>

      <Field label="Новый пароль ещё раз">
        <input name="repeat" type="password" autoComplete="new-password" required style={inputStyle} />
      </Field>

      <Button type="submit" pending={pending} pendingLabel="Меняем…">
        Сменить пароль
      </Button>
    </form>
  );
}
