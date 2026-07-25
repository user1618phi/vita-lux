"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getCatalogItem } from "@/data/catalog";
import type { CatalogItem } from "@/lib/catalog";

/* Cart + favorites, persisted to localStorage. Keyed by product handle so it
   maps straight onto the catalog. Hydrates on mount (empty on the server) to
   avoid SSR mismatch — badges/counts appear after hydration. */

export interface CartLine {
  handle: string;
  qty: number;
}
export interface DetailedLine {
  item: CatalogItem;
  qty: number;
}

interface CartState {
  items: CartLine[];
  favorites: string[];
  add: (handle: string, qty?: number) => void;
  remove: (handle: string) => void;
  setQty: (handle: string, qty: number) => void;
  clear: () => void;
  toggleFavorite: (handle: string) => void;
  isFavorite: (handle: string) => boolean;
  count: number;
  favCount: number;
  detailed: DetailedLine[];
  subtotal: number;
  hydrated: boolean;
}

const CartContext = createContext<CartState | null>(null);

const CART_KEY = "vitalux-cart";
const FAV_KEY = "vitalux-fav";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(read<CartLine[]>(CART_KEY, []));
    setFavorites(read<string[]>(FAV_KEY, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, hydrated]);
  useEffect(() => {
    if (hydrated) localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
  }, [favorites, hydrated]);

  const add = (handle: string, qty = 1) =>
    setItems((prev) => {
      const existing = prev.find((i) => i.handle === handle);
      if (existing) return prev.map((i) => (i.handle === handle ? { ...i, qty: i.qty + qty } : i));
      return [...prev, { handle, qty }];
    });

  const remove = (handle: string) => setItems((prev) => prev.filter((i) => i.handle !== handle));

  const setQty = (handle: string, qty: number) =>
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.handle !== handle) : prev.map((i) => (i.handle === handle ? { ...i, qty } : i))));

  const clear = () => setItems([]);

  const toggleFavorite = (handle: string) =>
    setFavorites((prev) => (prev.includes(handle) ? prev.filter((f) => f !== handle) : [...prev, handle]));

  const detailed = useMemo<DetailedLine[]>(() => {
    return items
      .map((i) => {
        const item = getCatalogItem(i.handle);
        return item ? { item, qty: i.qty } : null;
      })
      .filter((d): d is DetailedLine => d !== null);
  }, [items]);

  const subtotal = useMemo(() => detailed.reduce((s, d) => s + d.item.price * d.qty, 0), [detailed]);
  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);

  const value: CartState = {
    items,
    favorites,
    add,
    remove,
    setQty,
    clear,
    toggleFavorite,
    isFavorite: (handle) => favorites.includes(handle),
    count,
    favCount: favorites.length,
    detailed,
    subtotal,
    hydrated,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
