"use client";

import { useActionState } from "react";
import { saveProductAction, toggleVisibilityAction } from "../actions";
import { Button, ErrorBox, Field, SaveNotice, inputStyle } from "../ui";
import { PhotoManager } from "./PhotoManager";

/* Product editor.

   Four controls carry the common case — price, stock, visible, photos. Every
   other field lives behind «Подробнее», because the daily job is repricing, not
   re-describing. */

export interface ProductFormValues {
  productId?: string;
  handle: string;
  nameRu: string;
  nameKk: string;
  sku: string;
  categorySlug: string;
  collectionSlug: string;
  finish: string;
  status: "draft" | "active" | "archived";
  stock: "in" | "order" | "out";
  retailKzt: number | null;
  oldKzt: number | null;
  widthMm: number | null;
  depthMm: number | null;
  heightMm: number | null;
}

export function ProductForm({
  values,
  categories,
  collections,
  photos,
}: {
  values: ProductFormValues;
  categories: string[];
  collections: string[];
  photos: { id: string; url: string }[];
}) {
  const [state, action, pending] = useActionState(saveProductAction, null as { error?: string } | null);
  const [vis, visibilityAction, visPending] = useActionState(
    toggleVisibilityAction,
    null as { ok?: boolean; error?: string; published?: boolean } | null,
  );
  const isNew = !values.productId;

  return (
    <>
      <form action={action} className="flex flex-col gap-4">
        <ErrorBox>{state?.error}</ErrorBox>
        {values.productId ? <input type="hidden" name="productId" value={values.productId} /> : null}

        <Field label="Название (русский)">
          <input name="nameRu" defaultValue={values.nameRu} required style={inputStyle} />
        </Field>

        <Field label="Название (казахский)" hint="Обязательно — сайт двуязычный">
          <input name="nameKk" defaultValue={values.nameKk} required style={inputStyle} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Цена, ₸" hint="Пусто = по запросу">
            <input
              name="retailKzt"
              defaultValue={values.retailKzt ?? ""}
              inputMode="numeric"
              placeholder="по запросу"
              style={inputStyle}
            />
          </Field>
          <Field label="Старая цена, ₸" hint="Для показа скидки">
            <input
              name="oldKzt"
              defaultValue={values.oldKzt ?? ""}
              inputMode="numeric"
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Наличие">
          <select name="stock" defaultValue={values.stock} style={inputStyle}>
            <option value="in">В наличии</option>
            <option value="order">Под заказ</option>
            <option value="out">Нет в наличии</option>
          </select>
        </Field>

        <Field label="Показывать на сайте">
          <select name="status" defaultValue={values.status} style={inputStyle}>
            <option value="active">Да, показывать</option>
            <option value="draft">Нет, черновик</option>
            <option value="archived">В архиве</option>
          </select>
        </Field>

        <Field label="Артикул">
          <input name="sku" defaultValue={values.sku} required style={inputStyle} />
        </Field>

        <Field label="Категория">
          <select name="categorySlug" defaultValue={values.categorySlug} style={inputStyle}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <details className="rounded-lg" style={{ border: "0.5px solid var(--border)", padding: "12px 14px" }}>
          <summary className="font-sans text-[length:var(--text-body-s)] text-ink" style={{ cursor: "pointer" }}>
            Подробнее
          </summary>

          <div className="mt-4 flex flex-col gap-4">
            <Field label="Адрес на сайте" hint="Латиницей через дефис, например aura-540">
              <input name="handle" defaultValue={values.handle} required style={inputStyle} />
            </Field>

            <Field label="Коллекция">
              <select name="collectionSlug" defaultValue={values.collectionSlug} style={inputStyle}>
                <option value="">— без коллекции —</option>
                {collections.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Отделка" hint="Ключ из фильтров, например white-gloss">
              <input name="finish" defaultValue={values.finish} style={inputStyle} />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Field label="Ширина, мм">
                <input name="widthMm" defaultValue={values.widthMm ?? ""} inputMode="numeric" style={inputStyle} />
              </Field>
              <Field label="Глубина, мм">
                <input name="depthMm" defaultValue={values.depthMm ?? ""} inputMode="numeric" style={inputStyle} />
              </Field>
              <Field label="Высота, мм">
                <input name="heightMm" defaultValue={values.heightMm ?? ""} inputMode="numeric" style={inputStyle} />
              </Field>
            </div>
          </div>
        </details>

        <Button type="submit" pending={pending} pendingLabel="Сохраняем…">
          {isNew ? "Создать товар" : "Сохранить"}
        </Button>
      </form>

      {/* Photos are managed separately: uploads must not be lost if the form
          above fails validation. */}
      {values.productId ? (
        <div className="mt-8">
          <h2 className="m-0 mb-3 font-sans font-medium text-[length:var(--text-body)] text-ink">Фото</h2>
          <PhotoManager productId={values.productId} handle={values.handle} photos={photos} />
        </div>
      ) : (
        <p className="mt-6 font-sans text-[length:var(--text-caption)] text-slate">
          Фото можно будет загрузить сразу после создания товара.
        </p>
      )}

      {values.productId ? (
        <form action={visibilityAction} className="mt-8">
          <ErrorBox>{vis?.error}</ErrorBox>
          <SaveNotice ok={vis?.ok} published={vis?.published}>
            Видимость изменена.
          </SaveNotice>
          <input type="hidden" name="productId" value={values.productId} />
          <input type="hidden" name="handle" value={values.handle} />
          <Button type="submit" variant="secondary" size="sm" pending={visPending} pendingLabel="Меняем…">
            {values.status === "active" ? "Скрыть с сайта" : "Показать на сайте"}
          </Button>
        </form>
      ) : null}
    </>
  );
}
