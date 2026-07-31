"use client";

import { useEffect } from "react";

/* Экран ошибки.

   Без него сбой БД показывал голую страницу Next с английским текстом и без
   выхода: единственным действием оставалось закрыть вкладку. Здесь есть кнопка
   «Попробовать снова» — а неполадка с сетью до Supabase обычно тем и лечится.

   Текст ошибки НЕ показываем: в нём может оказаться строка подключения или
   фрагмент запроса. Владельцу магазина он всё равно ничего не скажет, а в
   консоль браузера пусть уходит — разработчику пригодится. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("admin error:", error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-10">
      <h1
        className="m-0 mb-2 font-display"
        style={{ fontSize: "var(--text-title)", color: "var(--text-primary)" }}
      >
        Что-то пошло не так
      </h1>
      <p
        className="m-0 mb-5 font-sans"
        style={{ fontSize: "var(--text-body-s)", color: "var(--text-secondary)" }}
      >
        Не удалось загрузить данные. Обычно помогает повторить попытку.
        {error.digest ? ` Код: ${error.digest}` : ""}
      </p>
      <button
        type="button"
        onClick={reset}
        className="w-full rounded-md font-sans"
        style={{
          height: 52,
          fontSize: "var(--text-body)",
          background: "var(--action-primary-bg)",
          color: "var(--action-primary-text)",
          border: "none",
          cursor: "pointer",
        }}
      >
        Попробовать снова
      </button>
    </main>
  );
}
