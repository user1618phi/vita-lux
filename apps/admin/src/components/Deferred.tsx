import type { ReactNode } from "react";
import { Suspense } from "react";

/* Кусок страницы, который ждёт X2pos.

   Смысл в том, чтобы страница НЕ ждала его вместе с ним.

   Раньше Сводка была одним большим `await`: пока не ответят продажи, клиенты и
   счета, не рендерилось ничего. X2pos отвечает из региона Vercel дольше, чем
   отведено функции, — и весь экран падал в «данные не получены», хотя всё
   остальное на нём считается по своей базе и готово мгновенно.

   С `Suspense` страница отдаётся сразу: заголовок, готовность каталога, блок
   «требует внимания» — всё это своё и быстрое. Данные склада дорисовываются,
   когда придут, а если не придут — гаснет только их кусок.

   Это не оптимизация, а изоляция отказа: внешний сервис перестаёт решать,
   покажется ли страница. */

export function Deferred({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return <Suspense fallback={fallback ?? <DeferredSkeleton />}>{children}</Suspense>;
}

export function DeferredSkeleton({ height = 120 }: { height?: number }) {
  return (
    <div
      className="rounded-lg"
      style={{
        height,
        background: "var(--surface-card)",
        border: "1px solid var(--border)",
      }}
      aria-hidden="true"
    />
  );
}

/* Полоса плиток на время загрузки — той же формы, что настоящая, чтобы
   вёрстка не прыгала, когда данные приедут. */
export function StatRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <DeferredSkeleton key={i} height={132} />
      ))}
    </>
  );
}
