"use client";

import { useActionState } from "react";
import { deletePhotoAction, makeCoverAction, uploadPhotosAction } from "../media-actions";
import { ErrorBox, OkBox } from "../ui";

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
    null as { error?: string; ok?: boolean; uploaded?: number } | null,
  );

  return (
    <div>
      <ErrorBox>{state?.error}</ErrorBox>
      {state?.ok ? <OkBox>Загружено фото: {state.uploaded}</OkBox> : null}

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
          className="font-sans text-[14px] text-ink"
        />

        <button
          type="submit"
          disabled={pending}
          className="rounded-md font-sans text-[15px]"
          style={{
            height: 48,
            background: "var(--surface-card)",
            border: "1px solid var(--border-control)",
            color: "var(--ink)",
            cursor: pending ? "default" : "pointer",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "Загружаем…" : "Загрузить фото"}
        </button>
        <p className="m-0 font-sans text-[12px] text-slate">
          До 10 МБ на фото. Сжимаем и конвертируем в WebP автоматически.
        </p>
      </form>

      {photos.length > 0 ? (
        <ul className="mt-4 m-0 p-0 list-none grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <li key={p.id} className="relative">
              <span
                className="block rounded-md overflow-hidden"
                style={{ aspectRatio: "1 / 1", background: "var(--porcelain)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </span>

              {i === 0 ? (
                <span
                  className="absolute top-1 left-1 rounded-sm px-1.5 font-sans text-[11px]"
                  style={{ background: "var(--ink)", color: "var(--porcelain)" }}
                >
                  обложка
                </span>
              ) : (
                <form action={makeCoverAction} className="absolute top-1 left-1">
                  <input type="hidden" name="mediaId" value={p.id} />
                  <input type="hidden" name="productId" value={productId} />
                  <input type="hidden" name="handle" value={handle} />
                  <button
                    type="submit"
                    className="rounded-sm px-1.5 font-sans text-[11px]"
                    style={{ background: "var(--white)", border: "0.5px solid var(--border)", color: "var(--ink)", cursor: "pointer" }}
                  >
                    сделать обложкой
                  </button>
                </form>
              )}

              <form action={deletePhotoAction} className="absolute top-1 right-1">
                <input type="hidden" name="mediaId" value={p.id} />
                <input type="hidden" name="handle" value={handle} />
                <button
                  type="submit"
                  aria-label="Удалить фото"
                  className="grid place-items-center rounded-sm"
                  style={{ width: 26, height: 26, background: "var(--white)", border: "0.5px solid var(--border)", color: "var(--state-danger)", cursor: "pointer" }}
                >
                  ×
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 font-sans text-[13px] text-slate">Фото пока нет.</p>
      )}
    </div>
  );
}
