"use client";

import { useActionState } from "react";
import { Button, ErrorBox, OkBox } from "../ui";
import { runSyncAction } from "./actions";

const JOBS = [
  { job: "stock", label: "Остатки", hint: "быстро, раз в 5 минут по расписанию" },
  { job: "catalog", label: "Каталог и цены", hint: "минуты, раз в 15 минут" },
  { job: "media", label: "Фотографии", hint: "пачками по 25, раз в час" },
  { job: "outbox", label: "Очередь заказов", hint: "отправка продаж в X2pos" },
] as const;

export function RunButtons() {
  const [state, action, pending] = useActionState(runSyncAction, null as
    | { ok?: boolean; error?: string; summary?: string }
    | null);

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {JOBS.map((j) => (
          <form key={j.job} action={action}>
            <input type="hidden" name="job" value={j.job} />
            <Button type="submit" variant="secondary" pending={pending} pendingLabel="Запускаем…">
              {j.label}
            </Button>
            <div
              className="mt-1 text-center"
              style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}
            >
              {j.hint}
            </div>
          </form>
        ))}
      </div>
      {state?.error ? (
        <div className="mt-3">
          <ErrorBox>{state.error}</ErrorBox>
        </div>
      ) : null}
      {state?.ok ? (
        <div className="mt-3">
          <OkBox>{state.summary}</OkBox>
        </div>
      ) : null}
    </div>
  );
}
