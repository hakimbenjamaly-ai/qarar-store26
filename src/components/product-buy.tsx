"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "./cart";
import { dict, money, pick } from "@/lib/i18n";

type V = { id: string; name: string; nameEn: string; size: string | null; color: string | null; price: number; compareAtPrice: number | null; stockQty: number };

export function ProductBuy({ slug, name, nameEn, image, local, variants }: { slug: string; name: string; nameEn: string; image: string | null; local: boolean; variants: V[] }) {
  const { add, l } = useCart();
  const t = dict(l);
  const firstAvailable = variants.find((v) => !local || v.stockQty > 0) ?? variants[0];
  const [vid, setVid] = useState(firstAvailable.id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const v = variants.find((x) => x.id === vid)!;
  const out = local && v.stockQty < 1;
  const max = local ? Math.min(v.stockQty, 99) : 99;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold text-brand-700">{money(v.price, l)}</span>
        {v.compareAtPrice && v.compareAtPrice > v.price && <span className="text-lg text-gray-400 line-through">{money(v.compareAtPrice, l)}</span>}
      </div>
      {variants.length > 1 && (
        <div>
          <div className="label">{t.choose}</div>
          <div className="flex flex-wrap gap-2">
            {variants.map((x) => {
              const disabled = local && x.stockQty < 1;
              return (
                <button
                  key={x.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => { setVid(x.id); setQty(1); setAdded(false); }}
                  className={`rounded-lg border px-3 py-2 text-sm ${x.id === vid ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-300 bg-white"} ${disabled ? "opacity-40 line-through" : ""}`}
                >
                  {pick(l, x.name, x.nameEn) || [x.color, x.size].filter(Boolean).join(" / ") || t.defaultVariant}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {local && <p className="text-sm text-gray-600">{out ? t.soldOut : t.available(v.stockQty)}</p>}
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg border bg-white">
          <button type="button" className="px-3 py-2" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={t.decrease}>−</button>
          <input value={qty} onChange={(e) => setQty(Math.max(1, Math.min(max, Number(e.target.value) || 1)))} className="w-12 text-center outline-none" inputMode="numeric" aria-label={t.quantity} />
          <button type="button" className="px-3 py-2" onClick={() => setQty((q) => Math.min(max, q + 1))} aria-label={t.increase}>+</button>
        </div>
        <button
          type="button"
          disabled={out}
          className="btn-primary flex-1 py-3 text-base"
          onClick={() => {
            add({ variantId: v.id, productSlug: slug, name, nameEn, variantName: v.name, variantNameEn: v.nameEn, image, price: v.price, quantity: qty, maxQty: local ? v.stockQty : null });
            setAdded(true);
          }}
        >
          {t.addToCart}
        </button>
      </div>
      {added && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {t.addedToCart}
          <Link href="/cart" className="font-semibold underline">{t.viewCart}</Link>
        </div>
      )}
    </div>
  );
}
