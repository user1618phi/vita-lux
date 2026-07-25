"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { resolveHandles, type LineSnapshot } from "@/app/actions/catalog";

/* Cart + favorites.

   Storage holds handles plus a display snapshot, never a join against an
   imported catalog module. That matters for two reasons:

   1. The catalog lives in Postgres. A client-side join would either ship the
      whole catalog to the browser or, worse, silently render every cart empty.
   2. The snapshot lets the cart paint instantly on load; a server action then
      re-reads real prices and stock and rewrites it. What the customer checks
      out against is always server-resolved.

   Items that disappear from the catalog are surfaced through `unavailable`
   rather than vanishing from the total with no explanation. */

export interface CartLine {
  handle: string;
  qty: number;
  snapshot: LineSnapshot;
}

export interface DetailedLine {
  item: LineSnapshot;
  qty: number;
}

interface CartState {
  items: CartLine[];
  favorites: string[];
  favoriteItems: LineSnapshot[];
  add: (handle: string, qty?: number, snapshot?: LineSnapshot) => void;
  remove: (handle: string) => void;
  setQty: (handle: string, qty: number) => void;
  clear: () => void;
  toggleFavorite: (handle: string, snapshot?: LineSnapshot) => void;
  isFavorite: (handle: string) => boolean;
  count: number;
  favCount: number;
  detailed: DetailedLine[];
  subtotal: number;
  hydrated: boolean;
  /** Names of lines dropped because they left the catalog. Show, don't swallow. */
  unavailable: string[];
  dismissUnavailable: () => void;
}

const CartContext = createContext<CartState | null>(null);

const CART_KEY = "vitalux-cart-v2";
const FAV_KEY = "vitalux-fav";
const LEGACY_CART_KEY = "vitalux-cart";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** A placeholder snapshot for a handle added before the server has answered. */
function stubSnapshot(handle: string): LineSnapshot {
  return {
    handle,
    sku: "",
    name: "…",
    price: 0,
    collection: "",
    stock: "order",
    priceOnRequest: false,
    installmentMonths: 12,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<LineSnapshot[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [unavailable, setUnavailable] = useState<string[]>([]);

  // Hydrate from storage, migrating the v1 shape ({handle, qty}) if present.
  useEffect(() => {
    const stored = read<CartLine[]>(CART_KEY, []);
    if (stored.length) {
      setItems(stored.filter((l) => l && typeof l.handle === "string"));
    } else {
      const legacy = read<{ handle: string; qty: number }[]>(LEGACY_CART_KEY, []);
      if (legacy.length) {
        setItems(legacy.map((l) => ({ handle: l.handle, qty: l.qty, snapshot: stubSnapshot(l.handle) })));
      }
    }
    setFavorites(read<string[]>(FAV_KEY, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, hydrated]);
  useEffect(() => {
    if (hydrated) localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
  }, [favorites, hydrated]);

  /* Re-resolve everything the browser remembers against the live catalog.
     Runs once per mount; keyed on the handle sets so adding an item that is
     already snapshotted does not trigger a round trip. */
  const cartKey = items.map((i) => i.handle).sort().join(",");
  const favKey = [...favorites].sort().join(",");

  useEffect(() => {
    if (!hydrated) return;
    const handles = [...new Set([...cartKey.split(","), ...favKey.split(",")])].filter(Boolean);
    if (!handles.length) {
      setFavoriteItems([]);
      return;
    }

    let cancelled = false;
    resolveHandles(handles)
      .then(({ found, missing }) => {
        if (cancelled) return;
        const byHandle = new Map(found.map((f) => [f.handle, f]));

        setItems((prev) => {
          const kept = prev.filter((l) => byHandle.has(l.handle));
          return kept.map((l) => ({ ...l, snapshot: byHandle.get(l.handle)! }));
        });

        if (missing.length) {
          // Name them from the snapshot we still hold, so the notice is readable.
          setUnavailable((prev) => {
            const names = missing.map(
              (h) => items.find((l) => l.handle === h)?.snapshot.name ?? h,
            );
            return [...new Set([...prev, ...names])];
          });
          setFavorites((prev) => prev.filter((h) => byHandle.has(h)));
        }

        setFavoriteItems(favKey ? favKey.split(",").map((h) => byHandle.get(h)).filter((x): x is LineSnapshot => !!x) : []);
      })
      .catch(() => {
        // Catalog unreachable: keep the snapshots so the cart still renders.
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, cartKey, favKey]);

  const add = useCallback((handle: string, qty = 1, snapshot?: LineSnapshot) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.handle === handle);
      if (existing) {
        return prev.map((i) => (i.handle === handle ? { ...i, qty: i.qty + qty } : i));
      }
      return [...prev, { handle, qty, snapshot: snapshot ?? stubSnapshot(handle) }];
    });
  }, []);

  const remove = useCallback((handle: string) => {
    setItems((prev) => prev.filter((i) => i.handle !== handle));
  }, []);

  const setQty = useCallback((handle: string, qty: number) => {
    setItems((prev) =>
      qty <= 0 ? prev.filter((i) => i.handle !== handle) : prev.map((i) => (i.handle === handle ? { ...i, qty } : i)),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const toggleFavorite = useCallback((handle: string, snapshot?: LineSnapshot) => {
    setFavorites((prev) => (prev.includes(handle) ? prev.filter((f) => f !== handle) : [...prev, handle]));
    if (snapshot) {
      setFavoriteItems((prev) =>
        prev.some((p) => p.handle === handle) ? prev.filter((p) => p.handle !== handle) : [...prev, snapshot],
      );
    }
  }, []);

  const detailed = useMemo<DetailedLine[]>(
    () => items.map((l) => ({ item: l.snapshot, qty: l.qty })),
    [items],
  );

  // Items priced "on request" carry no total until a manager quotes them.
  const subtotal = useMemo(
    () => detailed.reduce((s, d) => (d.item.priceOnRequest ? s : s + d.item.price * d.qty), 0),
    [detailed],
  );
  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);

  const value: CartState = {
    items,
    favorites,
    favoriteItems,
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
    unavailable,
    dismissUnavailable: () => setUnavailable([]),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
