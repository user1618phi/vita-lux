"use client";

import { useEffect, useState } from "react";
import { PriceTag } from "@/components/ui/PriceTag";
import { AddToCartButton } from "./AddToCartButton";
import { WhatsAppAction } from "./ChannelActions";

/* Mobile sticky buy bar — appears once the inline primary CTA is scrolled past.
   Mobile only (lg:hidden). Respects the iOS safe area.

   Появляется проявлением и коротким подъёмом, а НЕ выездом снизу. Выезд с
   translateY(120%) означал, что кнопка проезжает сквозь панель вкладок: она
   стартует из-за нижнего края, и полсекунды обе полосы занимают одно место —
   у панели видны макушки иконок, у кнопки обрезан низ. Сдвиг в 10px такого
   пересечения не создаёт. */

export interface MobileStickyBarProps {
  price: number;
  addLabel: string;
  addedLabel: string;
  handle?: string;
  waPhone: string;
  waMessage: string;
  waAria: string;
}

export function MobileStickyBar({ price, addLabel, addedLabel, handle, waPhone, waMessage, waAria }: MobileStickyBarProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const past = window.scrollY > 520;
      const nearBottom =
        window.innerHeight + window.scrollY > document.documentElement.scrollHeight - 200;
      setShow(past && !nearBottom);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="lg:hidden flex items-center gap-3"
      /* Спрятанная полоса остаётся в потоке: без inert она ловила бы касания
         и фокус поверх контента, будучи невидимой. */
      inert={!show}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        /* Стоим на панели вкладок. Она прячется при скролле вниз — и высота в
           переменной, иначе кнопка зависала бы с пустыми 56px под собой
           (см. --tabbar-h в tokens.css). */
        bottom: "var(--tabbar-h)",
        zIndex: 100,
        /* Отступ под вырез экрана нужен, только когда под нами ничего нет.
           Панель вкладок свой safe-area уже держит — складывая их, мы делали
           кнопку выше на треть без причины. */
        padding: "12px 16px calc(12px + max(0px, env(safe-area-inset-bottom) - var(--tabbar-h)))",
        background: "var(--glaze)",
        borderTop: "1px solid var(--line)",
        opacity: show ? 1 : 0,
        /* Опускается на место сверху, а не поднимается снизу: любое движение
           вверх начинается внутри полосы панели вкладок и на полупрозрачной
           фазе видно как наложение. */
        transform: show ? "translateY(0)" : "translateY(-8px)",
        transition: "opacity 180ms ease-out, transform 220ms ease-out, bottom 220ms ease-out",
      }}
    >
      <div style={{ flex: "none" }}>
        <PriceTag price={price} size="md" showBenefit={false} />
      </div>
      <AddToCartButton addLabel={addLabel} addedLabel={addedLabel} handle={handle} size="lg" iconSize={20} fullWidth style={{ flex: 1 }} />
      <WhatsAppAction iconOnly phone={waPhone} message={waMessage} ariaLabel={waAria} />
    </div>
  );
}
