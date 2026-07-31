"use client";

import { useActionState } from "react";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABEL, type OrderStatus } from "@vita/core/order/labels";
import { saveAdminNoteAction, setOrderStatusAction } from "../actions";
import { Button, ErrorBox, Field, OkBox, inputStyle } from "../../ui";

/* Смена статуса и заметка. Оба действия дают обратную связь: раньше формы
   админки, отправлявшие экшен напрямую, при сбое молча ничего не делали, и
   человек не понимал, сохранилось или нет. */

export function OrderForms({
  orderId,
  status,
  adminNote,
}: {
  orderId: string;
  status: OrderStatus;
  adminNote: string | null;
}) {
  const [st, statusAction, statusPending] = useActionState(
    setOrderStatusAction,
    null as { ok?: boolean; error?: string } | null,
  );
  const [nt, noteAction, notePending] = useActionState(
    saveAdminNoteAction,
    null as { ok?: boolean; error?: string } | null,
  );

  return (
    <>
      <section className="mt-6">
        <h2
          className="m-0 mb-2 font-sans font-medium"
          style={{ fontSize: "var(--text-body)", color: "var(--text-primary)" }}
        >
          Статус
        </h2>
        <form action={statusAction} className="flex flex-col gap-3">
          <ErrorBox>{st?.error}</ErrorBox>
          {st?.ok ? <OkBox>Статус обновлён.</OkBox> : null}
          <input type="hidden" name="orderId" value={orderId} />
          <select name="status" defaultValue={status} style={inputStyle}>
            {ORDER_STATUS_FLOW.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <Button type="submit" pending={statusPending} pendingLabel="Сохраняем…">
            Изменить статус
          </Button>
        </form>
      </section>

      <section className="mt-6">
        <form action={noteAction} className="flex flex-col gap-3">
          <ErrorBox>{nt?.error}</ErrorBox>
          {nt?.ok ? <OkBox>Заметка сохранена.</OkBox> : null}
          <input type="hidden" name="orderId" value={orderId} />
          {/* Подсказка не декоративная: в свободное поле рано или поздно впишут
              телефон, и тогда персональные данные окажутся вне трёх колонок,
              которые проект обещает держать отдельно. */}
          <Field label="Заметка" hint="Не пишите сюда телефон и адрес — они уже есть выше.">
            <textarea
              name="adminNote"
              defaultValue={adminNote ?? ""}
              rows={3}
              maxLength={2000}
              style={{ ...inputStyle, height: "auto", padding: "10px 14px", resize: "vertical" }}
            />
          </Field>
          <Button type="submit" variant="secondary" size="sm" pending={notePending} pendingLabel="Сохраняем…">
            Сохранить заметку
          </Button>
        </form>
      </section>
    </>
  );
}
