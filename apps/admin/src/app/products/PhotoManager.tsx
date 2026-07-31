"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { deletePhotoAction, makeCoverAction, uploadPhotosAction } from "../media-actions";
import { MAX_UPLOAD_BYTES, compressImage } from "@/lib/compress";
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

  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, startTransition] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [tooBig, setTooBig] = useState<string | null>(null);

  /* Форма не отправляется напрямую: сначала каждый файл сжимается в браузере,
     и только потом собирается FormData. Отправить оригинал нельзя — снимок с
     телефона не пролезет в лимит тела запроса. */
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTooBig(null);

    const picked = Array.from(inputRef.current?.files ?? []);
    if (!picked.length) return;

    const fd = new FormData();
    fd.set("productId", productId);
    fd.set("handle", handle);

    let total = 0;
    for (const [i, file] of picked.entries()) {
      setProgress(`Сжимаем ${i + 1} из ${picked.length}…`);
      const compressed = await compressImage(file);
      total += compressed.size;
      if (total > MAX_UPLOAD_BYTES) {
        setProgress(null);
        setTooBig(
          `Слишком много за раз (${Math.round(total / 1024 / 1024)} МБ). Загрузите по 2-3 фото.`,
        );
        return;
      }
      fd.append("photos", compressed);
    }

    setProgress(null);
    startTransition(() => action(fd));
  }

  const working = pending || busy || progress !== null;

  return (
    <div>
      <ErrorBox>{tooBig ?? state?.error}</ErrorBox>
      <SaveNotice ok={state?.ok} published={state?.published}>
        Загружено фото: {state?.uploaded}.
      </SaveNotice>

      <form onSubmit={submit} className="flex flex-col gap-3">
        {/* `capture="environment"` opens the rear camera straight from the
            warehouse; the accept list also pushes iOS to hand over JPEG. */}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          capture="environment"
          multiple
          className="font-sans text-[length:var(--text-body-s)] text-ink"
        />

        <Button
          type="submit"
          variant="secondary"
          size="sm"
          pending={working}
          pendingLabel={progress ?? "Загружаем…"}
        >
          Загрузить фото
        </Button>
        <p className="m-0 font-sans" style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}>
          Уменьшаем прямо в телефоне до отправки — фото любого размера подойдёт.
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
