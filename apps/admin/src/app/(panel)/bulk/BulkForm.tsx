"use client";

import { useActionState } from "react";
import { bulkUpdateAction, type AdminProductRow } from "@/app/actions";
import { Button, ErrorBox, SaveNotice, inputStyle } from "@/app/ui";

/* The screen that decides whether a real person keeps using this tool.

   Changing a price or flipping "in stock" is the daily job in a sanitaryware
   shop, and it must not cost a tap into a detail page and back. Everything is
   editable inline; one submit saves the lot. */

/* Тот же inputStyle из ui, но ниже и моноширинным: в таблице цен важно, чтобы
   цифры стояли в колонку. Роли — семантические, как и в общем примитиве. */
const cellInput = {
  ...inputStyle,
  height: 44,
  padding: "0 10px",
  fontFamily: "var(--font-mono)",
  fontSize: 16, // 16px or iOS zooms on focus
} as const;

export function BulkForm({ rows }: { rows: AdminProductRow[] }) {
  const [state, action, pending] = useActionState(
    bulkUpdateAction,
    null as { error?: string; ok?: boolean; changed?: number; published?: boolean } | null,
  );

  const editable = rows.filter((r) => r.variantId);

  return (
    <form action={action}>
      <ErrorBox>{state?.error}</ErrorBox>
      <SaveNotice
        ok={state?.ok}
        /* Нечего было менять — значит и публиковать нечего, вопрос о сайте не
           поднимается. */
        published={state?.changed === 0 ? undefined : state?.published}
      >
        {state?.changed === 0 ? "Изменений не было." : `Сохранено изменений: ${state?.changed}.`}
      </SaveNotice>

      {editable.length === 0 ? (
        /* Пустая категория раньше рисовала пустой список и кнопку «Сохранить»,
           которая отвечала «Нечего сохранять» — то есть выглядела сломанной. */
        <p
          className="mt-6 text-center font-sans"
          style={{ fontSize: "var(--text-body-s)", color: "var(--text-secondary)" }}
        >
          В этой категории нет товаров с ценой.
        </p>
      ) : null}

      <ul className="m-0 p-0 list-none flex flex-col gap-2">
        {editable.map((r) => (
          <li
            key={r.variantId}
            className="rounded-lg p-3"
            style={{ background: "var(--surface-card)", border: "0.5px solid var(--border)" }}
          >
            <input type="hidden" name={`handle.${r.variantId}`} value={r.handle} />

            <div className="font-sans text-[length:var(--text-body-s)] text-ink truncate">{r.name}</div>
            <div className="mt-0.5 vl-mono text-[length:var(--text-caption)] text-slate">{r.sku ?? "—"}</div>

            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 sm:items-center">
              <label className="block">
                <span className="sr-only">Цена, ₸</span>
                <input
                  name={`price.${r.variantId}`}
                  defaultValue={r.retailKzt ?? ""}
                  inputMode="numeric"
                  placeholder="по запросу"
                  aria-label={`Цена: ${r.name}`}
                  style={cellInput}
                />
              </label>

              <label className="block">
                <span className="sr-only">Наличие</span>
                <select
                  name={`stock.${r.variantId}`}
                  defaultValue={r.stock ?? "order"}
                  aria-label={`Наличие: ${r.name}`}
                  style={{ ...cellInput, width: "auto", fontFamily: "var(--font-sans)" }}
                >
                  <option value="in">В наличии</option>
                  <option value="order">Под заказ</option>
                  <option value="out">Нет</option>
                </select>
              </label>
            </div>
          </li>
        ))}
      </ul>

      {/* Sticky so the button is reachable after scrolling a long list.
          Кнопки нет, когда сохранять нечего: раньше она висела над пустым
          списком и на нажатие отвечала «Нечего сохранять». */}
      {editable.length > 0 ? (
        <div
          className="sticky bottom-0 mt-4 py-3"
          style={{ background: "var(--surface-page)", borderTop: "0.5px solid var(--border)" }}
        >
          <Button type="submit" pending={pending} pendingLabel="Сохраняем…">
            Сохранить
          </Button>
          <p className="m-0 mt-2 text-center font-sans text-[length:var(--text-caption)] text-slate">
            Пустая цена = «Цена по запросу». Товар нельзя будет добавить в корзину.
          </p>
        </div>
      ) : null}
    </form>
  );
}
