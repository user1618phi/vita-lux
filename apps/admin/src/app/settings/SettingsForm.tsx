"use client";

import { useActionState } from "react";
import { saveSettingsAction } from "../actions";
import { ErrorBox, Field, OkBox, inputStyle } from "../ui";

export interface SettingGroup {
  title: string;
  hint?: string;
  fields: { key: string; label: string; hint?: string; value: string }[];
}

export function SettingsForm({ groups }: { groups: SettingGroup[] }) {
  const [state, action, pending] = useActionState(
    saveSettingsAction,
    null as { error?: string; ok?: boolean; saved?: number } | null,
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <ErrorBox>{state?.error}</ErrorBox>
      {state?.ok ? <OkBox>Сохранено. Сайт обновится сразу.</OkBox> : null}

      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="m-0 mb-1 font-sans font-medium text-[16px] text-ink">{g.title}</h2>
          {g.hint ? <p className="m-0 mb-3 font-sans text-[13px] text-slate">{g.hint}</p> : null}
          <div className="flex flex-col gap-3">
            {g.fields.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <input name={`setting.${f.key}`} defaultValue={f.value} style={inputStyle} />
              </Field>
            ))}
          </div>
        </section>
      ))}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md font-sans text-[16px]"
        style={{
          height: 52,
          background: "var(--ink)",
          color: "var(--glaze)",
          border: "none",
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? "Сохраняем…" : "Сохранить настройки"}
      </button>
    </form>
  );
}
