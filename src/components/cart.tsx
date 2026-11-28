"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

export type CartLine = {
  variantId: string;
  productSlug: string;
  name: string;
  nameEn?: string;
  variantName: string;
  variantNameEn?: string;
  image: string | null;
  price: number; // للعرض فقط — السعر الفعلي يُحسب في الخادم عند إتمام الطلب
  quantity: number;
  maxQty: number | null; // للمخزون المحلي
};

type Ctx = {
  l: Locale;
  lines: CartLine[];
  ready: boolean;
  add: (l: CartLine) => void;
  setQty: (variantId: string, q: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const CartContext = createContext<Ctx | null>(null);
const KEY = "qarar_cart_v1";

export function CartProvider({ children, l }: { children: React.ReactNode; l: Locale }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {}
  }, [lines, ready]);

  const clamp = (q: number, max: number | null) => Math.max(1, Math.min(q, max ?? 99, 99));

  const add = useCallback((l: CartLine) => {
    setLines((prev) => {
      const ex = prev.find((p) => p.variantId === l.variantId);
      if (ex) return prev.map((p) => (p.variantId === l.variantId ? { ...l, quantity: clamp(p.quantity + l.quantity, l.maxQty) } : p));
      return [...prev, { ...l, quantity: clamp(l.quantity, l.maxQty) }];
    });
  }, []);
  const setQty = useCallback((id: string, q: number) => setLines((prev) => prev.map((p) => (p.variantId === id ? { ...p, quantity: clamp(q, p.maxQty) } : p))), []);
  const remove = useCallback((id: string) => setLines((prev) => prev.filter((p) => p.variantId !== id)), []);
  const clear = useCallback(() => setLines([]), []);

  const count = lines.reduce((s, l) => s + l.quantity, 0);
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.price, 0);

  return <CartContext.Provider value={{ l, lines, ready, add, setQty, remove, clear, count, subtotal }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const c = useContext(CartContext);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}

export function CartBadge() {
  const { count, ready } = useCart();
  if (!ready || count === 0) return null;
  return <span className="absolute -end-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">{count}</span>;
}
