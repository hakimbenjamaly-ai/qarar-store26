"use client";

import Link from "next/link";
import { useCart } from "@/components/cart";
import { dict, money, pick } from "@/lib/i18n";

export default function CartPage() {
  const { l, lines, ready, setQty, remove, subtotal } = useCart();
  const t = dict(l);
  if (!ready) return <div className="container-x py-10">...</div>;
  return (
    <div className="container-x py-8">
      <h1 className="mb-6 text-2xl font-bold">{t.cartTitle}</h1>
      {lines.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="mb-4 text-gray-600">{t.cartEmpty}</p>
          <Link href="/" className="btn-primary">{t.continueShopping}</Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <ul className="card divide-y">
            {lines.map((line) => (
              <li key={line.variantId} className="flex gap-3 p-4">
                <Link href={`/product/${encodeURIComponent(line.productSlug)}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {line.image && <img src={line.image} alt="" className="h-full w-full object-cover" />}
                </Link>
                <div className="flex flex-1 flex-col gap-1">
                  <Link href={`/product/${encodeURIComponent(line.productSlug)}`} className="font-medium hover:text-brand-700">{pick(l, line.name, line.nameEn)}</Link>
                  {line.variantName && <span className="text-sm text-gray-500">{pick(l, line.variantName, line.variantNameEn)}</span>}
                  <span className="text-sm">{money(line.price, l)}</span>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex items-center rounded-lg border">
                      <button className="px-3 py-1" onClick={() => setQty(line.variantId, line.quantity - 1)} aria-label={t.decrease}>−</button>
                      <span className="w-8 text-center">{line.quantity}</span>
                      <button className="px-3 py-1" onClick={() => setQty(line.variantId, line.quantity + 1)} aria-label={t.increase}>+</button>
                    </div>
                    <button className="text-sm text-red-600 hover:underline" onClick={() => remove(line.variantId)}>{t.remove}</button>
                  </div>
                </div>
                <div className="font-semibold">{money(line.price * line.quantity, l)}</div>
              </li>
            ))}
          </ul>
          <aside className="card h-fit space-y-3 p-4">
            <div className="flex justify-between"><span>{t.subtotal}</span><span className="font-bold">{money(subtotal, l)}</span></div>
            <p className="text-xs text-gray-500">{t.cartNote}</p>
            <Link href="/checkout" className="btn-primary w-full py-3">{t.checkout}</Link>
          </aside>
        </div>
      )}
    </div>
  );
}
