"use client";

import { useActionState } from "react";
import { Button, SaveNotice } from "@/app/ui";
import { publishReadyAction } from "./publish-action";

/* Пакетная публикация.

   Смысл в том, чтобы очередь черновиков заканчивалась. Когда у товара закрыты
   название, раздел, фото и цена, отдельного решения он не требует — его надо
   просто выпустить на сайт, и делать это по одному 90 раз незачем. */

export function PublishReady({ ids, count }: { ids: string[]; count: number }) {
  const [state, action, pending] = useActionState(publishReadyAction, null as
    | { ok?: boolean; error?: string; published?: boolean; count?: number }
    | null);

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3"
      style={{ background: "var(--tint-brass)", border: "1px solid var(--tint-brass-border)" }}
    >
      <div className="min-w-0">
        <div style={{ color: "var(--text-primary)" }}>
          {count === 1 ? "1 черновик готов к публикации" : `${count} черновиков готовы к публикации`}
        </div>
        <div style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
          У них заполнены название, раздел, фото и цена — можно выпускать на сайт.
        </div>
        {state ? (
          <div className="mt-2">
            <SaveNotice ok={state.ok} published={state.published}>
              {state.count ? `Опубликовано: ${state.count}.` : null}
            </SaveNotice>
            {state.error ? (
              <span style={{ color: "var(--state-danger)", fontSize: "var(--text-body-s)" }}>
                {state.error}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <form action={action} className="shrink-0">
        <input type="hidden" name="ids" value={ids.join(",")} />
        <Button type="submit" fullWidth={false} pending={pending} pendingLabel="Публикуем…">
          Опубликовать все
        </Button>
      </form>
    </div>
  );
}
