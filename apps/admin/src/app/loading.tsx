/* Каждый экран админки — `force-dynamic` и ходит в Postgres по сети.
   Без этого файла переход между разделами на плохой связи означал несколько
   секунд БЕЛОЙ страницы: браузер уже ушёл со старой, а новая ещё не пришла, и
   человек не понимает, нажалось ли вообще. */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-5">
      <p
        className="m-0 font-sans"
        aria-live="polite"
        style={{ fontSize: "var(--text-body-s)", color: "var(--text-secondary)" }}
      >
        Загружаем…
      </p>
    </main>
  );
}
