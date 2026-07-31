"use client";

import { useActionState } from "react";
import { deletePhotoAction, makeCoverAction, uploadPhotosAction } from "../media-actions";
import { Button, ConfirmButton, ErrorBox, SaveNotice } from "../ui";

export function PhotoManager({
  productId,
  handle,
  photos,
}: {
  productId: string;
  handle: string;
  photos: { id: string; url: string }[];
}) {
  const [state, action, pending] = useActionState(
    uploadPhotosAction,
    null as { error?: string; ok?: boolean; uploaded?: number; published?: boolean } | null,
  );

  return (
    <div>
      <ErrorBox>{state?.error}</ErrorBox>
      <SaveNotice ok={state?.ok} published={state?.published}>
        Загружено фото: {state?.uploaded}.
      </SaveNotice>

      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="handle" value={handle} />

        {/* `capture="environment"` opens the rear camera straight from the
            warehouse; the accept list also pushes iOS to hand over JPEG. */}
        <input
          type="file"
          name="photos"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          capture="environment"
          multiple
          className="font-sans text-[length:var(--text-body-s)] text-ink"
        />

        <Button type="submit" variant="secondary" size="sm" pending={pending} pendingLabel="Загружаем…">
          Загрузить фото
        </Button>
        <p className="m-0 font-sans" style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}>
          Сжимаем и конвертируем в WebP автоматически.
        </p>
      </form>

      {photos.length > 0 ? (
        /* Две колонки на телефоне, а не три. При трёх на 390px миниатюра
           получалась ~118px, и управляющие элементы налезали друг на друга.
           Управление вынесено ПОД миниатюру: поверх фото любая кнопка либо
           закрывает то, что нужно рассмотреть, либо промахивается пальцем. */
        <ul className="mt-4 m-0 p-0 list-none grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((p, i) => (
            <li key={p.id}>
              <span
                className="block rounded-md overflow-hidden relative"
                style={{ aspectRatio: "1 / 1", background: "var(--surface-media)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="vl-photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                {i === 0 ? (
                  <span
                    className="absolute top-1 left-1 rounded-sm px-1.5 font-sans"
                    style={{
                      fontSize: "var(--text-micro)",
                      background: "var(--surface-on-photo)",
                      color: "var(--text-on-photo)",
                    }}
                  >
                    обложка
                  </span>
                ) : null}
              </span>

              <div className="mt-1.5 flex items-center justify-between gap-1">
                {i === 0 ? (
                  <span />
                ) : (
                  <form action={makeCoverAction}>
                    <input type="hidden" name="mediaId" value={p.id} />
                    <input type="hidden" name="productId" value={productId} />
                    <input type="hidden" name="handle" value={handle} />
                    <Button type="submit" variant="secondary" size="sm" fullWidth={false}>
                      Обложка
                    </Button>
                  </form>
                )}

                <form action={deletePhotoAction}>
                  <input type="hidden" name="mediaId" value={p.id} />
                  <input type="hidden" name="handle" value={handle} />
                  {/* Удаление сносит и строку в БД, и оба объекта в хранилище —
                      необратимо. Раньше это делала кнопка 26×26 без вопроса. */}
                  <ConfirmButton aria-label="Удалить фото" confirmLabel="Удалить?">
                    Удалить
                  </ConfirmButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 font-sans" style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
          Фото пока нет.
        </p>
      )}
    </div>
  );
}
