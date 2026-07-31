"use client";

import { useEffect, useState } from "react";

/* Прячет закреплённый элемент при скролле вниз и возвращает при скролле вверх.

   Пороги разные намеренно. Спрятать — 12px: случайное дрожание пальца не должно
   убирать навигацию. Показать — 6px: движение вверх почти всегда означает «хочу
   назад к управлению», и панель обязана появиться от малейшего жеста, а не
   после полноценного свайпа.

   Верх страницы — всегда видно: иначе на короткой странице, где скроллить уже
   некуда, панель осталась бы спрятанной навсегда.

   Порог считаем от последней ТОЧКИ РАЗВОРОТА, а не от предыдущего события
   скролла. Иначе при медленном протягивании каждое событие даёт дельту в
   один-два пикселя, ни один порог не набирается, и панель не реагирует вообще. */

const HIDE_AFTER = 12;
const SHOW_AFTER = 6;
const ALWAYS_VISIBLE_ABOVE = 64;

export function useHideOnScrollDown(): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    /* anchor — точка разворота, от неё копится сдвиг. lastY — позиция на
       прошлом кадре, по ней определяем направление. Это разные величины:
       если совместить их в одну, событие разворота уходит на переустановку
       точки отсчёта и само в порог не попадает. Рывок вверх, уложившийся в
       одно-два события (а короткий свайп именно такой), тогда не показывает
       панель вообще. */
    let anchor = window.scrollY;
    let lastY = window.scrollY;
    let goingDown = true;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      // iOS на оттяжке даёт отрицательный scrollY и значения больше максимума —
      // без зажима резинка читается как рывок в сторону и дёргает панель.
      const y = Math.max(0, Math.min(window.scrollY, Math.max(0, max)));

      if (y <= ALWAYS_VISIBLE_ABOVE) {
        anchor = y;
        lastY = y;
        goingDown = true;
        setHidden(false);
        return;
      }
      if (y === lastY) return;

      const movingDown = y > lastY;
      if (movingDown !== goingDown) {
        goingDown = movingDown;
        anchor = lastY; // сама точка разворота, а не текущая позиция
      }
      lastY = y;

      // Порог проверяем в этом же проходе — не откладывая до следующего события.
      const travelled = Math.abs(y - anchor);
      if (goingDown && travelled > HIDE_AFTER) {
        anchor = y;
        setHidden(true);
      } else if (!goingDown && travelled > SHOW_AFTER) {
        anchor = y;
        setHidden(false);
      }
    };

    const onScroll = () => {
      // Скролл сыплет событиями чаще кадра; читаем позицию один раз на кадр,
      // иначе на каждое движение пальца уходит пачка лишних layout-чтений.
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    // Появление адресной строки меняет innerHeight и максимум скролла.
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return hidden;
}
