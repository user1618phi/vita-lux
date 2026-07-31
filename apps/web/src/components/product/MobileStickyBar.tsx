"use client";

import { useEffect, useState } from "react";
import { PriceTag } from "@/components/ui/PriceTag";
import { AddToCartButton } from "./AddToCartButton";
import { WhatsAppAction } from "./ChannelActions";

/* Mobile sticky buy bar — slides up once the inline primary CTA is scrolled
   past. Mobile only (lg:hidden). Respects the iOS safe area. */

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
      className="lg:hidden flex items-center gap-3 bottom-14 md:bottom-0"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        zIndex: 100,
        padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
        background: "var(--glaze)",
        borderTop: "1px solid var(--line)",
        transform: show ? "translateY(0)" : "translateY(120%)",
        transition: "transform 220ms ease-out",
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
