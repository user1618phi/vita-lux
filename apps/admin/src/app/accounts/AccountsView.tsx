"use client";

import { useActionState } from "react";
import {
  createAccountAction,
  revokeSessionsAction,
  setAccountRoleAction,
  toggleAccountAction,
  type AccountRow,
} from "./actions";
import { Button, ConfirmButton, ErrorBox, Field, OkBox, inputStyle } from "../ui";

function fmt(d: Date | null): string {
  return d ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(d) : "—";
}

export function AccountsView({ rows, currentId }: { rows: AccountRow[]; currentId: string }) {
  const [state, action, pending] = useActionState(
    createAccountAction,
    null as { ok?: boolean; error?: string; username?: string; password?: string } | null,
  );

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2
          className="m-0 mb-2 font-sans font-medium"
          style={{ fontSize: "var(--text-body)", color: "var(--text-primary)" }}
        >
          Новый доступ
        </h2>
        <form action={action} className="flex flex-col gap-3">
          <ErrorBox>{state?.error}</ErrorBox>
          {/* Пароль показывается ровно один раз и нигде не сохраняется. */}
          {state?.ok ? (
            <OkBox>
              Создан «{state.username}». Пароль:{" "}
              <strong className="vl-mono">{state.password}</strong>. Показан один раз — передайте
              лично и сохраните в менеджере паролей.
            </OkBox>
          ) : null}

          <Field label="Логин" hint="Латиница, цифры, точка, дефис">
            <input name="username" required minLength={3} autoCapitalize="none" style={inputStyle} />
          </Field>
          <Field label="Роль" hint="Менеджеру закрыты настройки и этот экран">
            <select name="role" defaultValue="manager" style={inputStyle}>
              <option value="manager">Менеджер</option>
              <option value="owner">Владелец</option>
            </select>
          </Field>
          <Button type="submit" pending={pending} pendingLabel="Создаём…">
            Создать доступ
          </Button>
        </form>
      </section>

      <section>
        <h2
          className="m-0 mb-2 font-sans font-medium"
          style={{ fontSize: "var(--text-body)", color: "var(--text-primary)" }}
        >
          Кто имеет доступ
        </h2>
        <ul className="m-0 p-0 list-none flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-lg p-3"
              style={{
                background: "var(--surface-card)",
                border: "0.5px solid var(--border)",
                opacity: r.disabledAt ? 0.55 : 1,
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-sans" style={{ fontSize: "var(--text-body-s)", color: "var(--text-primary)" }}>
                  {r.username}
                  {r.id === currentId ? " (это вы)" : ""}
                  {r.disabledAt ? " · отключён" : ""}
                </span>
                <span className="font-sans" style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}>
                  вход: {fmt(r.lastLoginAt)} · сессий: {r.sessions}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <form action={setAccountRoleAction} className="flex items-center gap-1">
                  <input type="hidden" name="userId" value={r.id} />
                  <select
                    name="role"
                    defaultValue={r.role}
                    style={{ ...inputStyle, width: "auto", height: 44 }}
                    aria-label={`Роль: ${r.username}`}
                  >
                    <option value="manager">Менеджер</option>
                    <option value="owner">Владелец</option>
                  </select>
                  <Button type="submit" variant="secondary" size="sm" fullWidth={false}>
                    Сменить роль
                  </Button>
                </form>

                {r.sessions > 0 ? (
                  <form action={revokeSessionsAction}>
                    <input type="hidden" name="userId" value={r.id} />
                    <Button type="submit" variant="secondary" size="sm" fullWidth={false}>
                      Закрыть сессии
                    </Button>
                  </form>
                ) : null}

                {/* Себя отключить нельзя — сервер это тоже проверяет. */}
                {r.id !== currentId ? (
                  <form action={toggleAccountAction}>
                    <input type="hidden" name="userId" value={r.id} />
                    {r.disabledAt ? (
                      <Button type="submit" variant="secondary" size="sm" fullWidth={false}>
                        Включить
                      </Button>
                    ) : (
                      <ConfirmButton confirmLabel="Отключить?">Отключить</ConfirmButton>
                    )}
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
