import Link from "next/link";

/* Этот же файл отвечает и когда ADMIN_ENABLED не выставлен: корневой layout
   зовёт notFound(). Поэтому текст нейтральный — он не должен подсказывать
   постороннему, что за 404 скрывается панель управления. */
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-10">
      <h1
        className="m-0 mb-2 font-display"
        style={{ fontSize: "var(--text-title)", color: "var(--text-primary)" }}
      >
        Страница не найдена
      </h1>
      <Link
        href="/products"
        className="font-sans"
        style={{ fontSize: "var(--text-body-s)", color: "var(--brass-text)" }}
      >
        К товарам
      </Link>
    </main>
  );
}
