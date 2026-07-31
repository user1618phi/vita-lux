"use client";

import { useEffect, useState } from "react";
import { WhatsAppGlyph } from "@/components/ui/WhatsAppGlyph";
import { whatsAppLink } from "@vita/data/content/products";

/* Плавающая кнопка WhatsApp — подменяет обычные кнопки канала, пока ни одной
   из них нет на экране.

   Появляется, когда «Спросить в WhatsApp» в первом экране ушла вверх, и
   исчезает, как только видно любую настоящую кнопку канала: либо вернулись
   к первому экрану, либо доскроллили до «Написать в WhatsApp» внизу. Две
   кнопки на одном экране — это уже не подсказка, а навязчивость.

   Якоря ищем по атрибуту `data-wa-cta`, а не прокидываем ref: кнопки живут в
   разных компонентах, часть из них серверные, и ref через эту границу не
   передать. Разметке достаточно пометить себя — кто и зачем следит, её не
   касается. */

export interface WhatsAppFabProps {
  phone: string;
  message: string;
  /** Что произойдёт по нажатию — уходит в aria-label и подсказку. */
  label: string;
}

export function WhatsAppFab({ phone, message, label }: WhatsAppFabProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const anchors = document.querySelectorAll("[data-wa-cta]");
    if (!anchors.length) return;

    const onScreen = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) onScreen.add(e.target);
          else onScreen.delete(e.target);
        }
        setShow(onScreen.size === 0);
      },
      /* Небольшой отрицательный отступ снизу: кнопка канала, наполовину
         выехавшая из-под нижнего края, читается как «уже не на экране», и
         плавающая должна успеть появиться до того, как та уйдёт совсем. */
      { rootMargin: "0px 0px -64px 0px", threshold: 0 },
    );
    anchors.forEach((a) => io.observe(a));
    return () => io.disconnect();
  }, []);

  return (
    <a
      href={whatsAppLink(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      /* Спрятанная кнопка остаётся в разметке — без inert она ловила бы
         касания в правом нижнем углу, будучи невидимой. */
      inert={!show}
      style={{
        position: "fixed",
        right: 16,
        /* Над панелью вкладок: она прячется при скролле, и высота у неё
           переменная (см. --tabbar-h в tokens.css). */
        bottom: "calc(var(--tabbar-h) + 16px)",
        // Ниже модалок (60) и шторок (50), выше остального содержимого.
        zIndex: 45,
        width: 56,
        height: 56,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        /* Знак WhatsApp самоцветный и сам по себе круглый — фон под него не
           подкладываем: перекрашивать чужой товарный знак нельзя, а своя
           заливка под ним дала бы круг в круге. */
        opacity: show ? 1 : 0,
        transform: show ? "scale(1)" : "scale(0.85)",
        pointerEvents: show ? "auto" : "none",
        transition: "opacity 180ms ease-out, transform 180ms ease-out, bottom 220ms ease-out",
      }}
    >
      <WhatsAppGlyph size={56} />
    </a>
  );
}
