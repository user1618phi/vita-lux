"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useCart } from "@/context/CartContext";
import { track } from "@/lib/analytics";

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
  style,
}: AddToCartButtonProps) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onClick = () => {
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
      onClick={onClick}
      iconLeft={<Icon name={added ? "check" : "shopping-bag"} size={iconSize} />}
      style={style}
    >
      {added ? addedLabel : addLabel}
    </Button>
  );
}
