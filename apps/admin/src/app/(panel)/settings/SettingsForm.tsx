"use client";

import { useActionState } from "react";
import { saveSettingsAction } from "@/app/actions";
import { Button, ErrorBox, Field, SaveNotice, inputStyle } from "@/app/ui";

export interface SettingGroup {
  title: string;
  hint?: string;
  fields: { key: string; label: string; hint?: string; value: string }[];
}

export function SettingsForm({ groups }: { groups: SettingGroup[] }) {
  const [state, action, pending] = useActionState(
    saveSettingsAction,
    null as { error?: string; ok?: boolean; saved?: number; published?: boolean } | null,
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <ErrorBox>{state?.error}</ErrorBox>
      <SaveNotice ok={state?.ok} published={state?.published}>
        Сохранено.
      </SaveNotice>

      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="m-0 mb-1 font-sans font-medium text-[length:var(--text-body)] text-ink">{g.title}</h2>
          {g.hint ? <p className="m-0 mb-3 font-sans text-[length:var(--text-caption)] text-slate">{g.hint}</p> : null}
          <div className="flex flex-col gap-3">
            {g.fields.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <input name={`setting.${f.key}`} defaultValue={f.value} style={inputStyle} />
              </Field>
            ))}
          </div>
        </section>
      ))}

      <Button type="submit" pending={pending} pendingLabel="Сохраняем…">
        Сохранить настройки
      </Button>
    </form>
  );
}
