"use client";

import { useActionState } from "react";
import { bulkUpdateAction, type AdminProductRow } from "../actions";
import { ErrorBox, OkBox } from "../ui";

/* The screen that decides whether a real person keeps using this tool.

   Changing a price or flipping "in stock" is the daily job in a sanitaryware
   shop, and it must not cost a tap into a detail page and back. Everything is
   editable inline; one submit saves the lot. */

const cellInput = {
  width: "100%",
  height: 44,
  padding: "0 10px",
  background: "var(--white)",
  border: "1px solid var(--border-control)",
  borderRadius: "var(--radius-md)",
  outline: "none",
  fontFamily: "var(--font-mono)",
  fontSize: 16, // 16px or iOS zooms on focus
  color: "var(--ink)",
} as const;

export function BulkForm({ rows }: { rows: AdminProductRow[] }) {
  const [state, action, pending] = useActionState(
    bulkUpdateAction,
    null as { error?: string; ok?: boolean; changed?: number } | null,
  );

  const editable = rows.filter((r) => r.variantId);

  return (
    <form action={action}>
      <ErrorBox>{state?.error}</ErrorBox>
      {state?.ok ? (
        <OkBox>
          {state.changed === 0 ? "Изменений не было" : `Сохранено изменений: ${state.changed}`}
        </OkBox>
      ) : null}

      <ul className="m-0 p-0 list-none flex flex-col gap-2">
        {editable.map((r) => (
          <li
            key={r.variantId}
            className="rounded-lg p-3"
            style={{ background: "var(--surface-card)", border: "0.5px solid var(--border)" }}
          >
            <input type="hidden" name={`handle.${r.variantId}`} value={r.handle} />

            <div className="font-sans text-[14px] text-ink truncate">{r.name}</div>
            <div className="mt-0.5 vl-mono text-[12px] text-slate">{r.sku ?? "—"}</div>

            <div className="mt-2.5 grid grid-cols-[1fr_auto] gap-2 items-center">
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

      {/* Sticky so the button is reachable after scrolling a long list. */}
      <div
        className="sticky bottom-0 mt-4 py-3"
        style={{ background: "var(--surface-page)", borderTop: "0.5px solid var(--border)" }}
      >
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md font-sans text-[16px]"
          style={{
            height: 52,
            background: "var(--ink)",
            color: "var(--glaze)",
            border: "none",
            cursor: pending ? "default" : "pointer",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "Сохраняем…" : "Сохранить"}
        </button>
        <p className="m-0 mt-2 text-center font-sans text-[12px] text-slate">
          Пустая цена = «Цена по запросу». Товар нельзя будет добавить в корзину.
        </p>
      </div>
    </form>
  );
}
