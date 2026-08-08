"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useCart } from "@/context/CartContext";
import { track } from "@vita/core/analytics";

/* Primary add-to-cart. Adds the product to the cart and flips to a confirmation
   label for ~1.7s. `handle` ties it to a catalog product; without it, it's a
   visual-only shell (e.g. the bundle button until bundles are modelled). */

export interface AddToCartButtonProps {
  addLabel: string;
  addedLabel: string;
  handle?: string;
  qty?: number;
  size?: "md" | "lg";
  iconSize?: number;
  fullWidth?: boolean;
  /** Товар без цены («по запросу») или снятый с продажи — класть в корзину нельзя. */
  disabled?: boolean;
  style?: CSSProperties;
}

export function AddToCartButton({
  addLabel,
  addedLabel,
  handle,
  qty = 1,
  size = "lg",
  iconSize = 24,
  fullWidth = true,
  disabled = false,
  style,
}: AddToCartButtonProps) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onClick = () => {
    /* Атрибут disabled у кнопки — не единственный рубеж: обработчик вызывают и
       программно, а положить в корзину товар без цены значит собрать заказ,
       который чекаут потом отклонит целиком. */
    if (disabled) return;
    if (handle) {
      add(handle, qty);
      track("add_to_cart", { sku: handle, quantity: qty });
    }
    if (timer.current) clearTimeout(timer.current);
    setAdded(true);
    timer.current = setTimeout(() => setAdded(false), 1700);
  };

  return (
    <Button
      variant="primary"
      size={size}
      fullWidth={fullWidth}
      disabled={disabled}
      onClick={onClick}
      iconLeft={<Icon name={added ? "check" : "shopping-bag"} size={iconSize} />}
      style={style}
    >
      {added ? addedLabel : addLabel}
    </Button>
  );
}
