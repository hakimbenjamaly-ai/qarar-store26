"use client";

import Link from "next/link";
import { useCart } from "@/components/cart";

const fmt = (n: number) => `${n.toLocaleString("ar-LY", { maximumFractionDigits: 2 })} د.ل`;

export default function CartPage() {
  const { lines, ready, setQty, remove, subtotal } = useCart();
  if (!ready) return <div className="container-x py-10">...</div>;
  return (
    <div className="container-x py-8">
      <h1 className="mb-6 text-2xl font-bold">سلة المشتريات</h1>
      {lines.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="mb-4 text-gray-600">السلة فارغة.</p>
          <Link href="/" className="btn-primary">تابع التسوق</Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <ul className="card divide-y">
            {lines.map((l) => (
              <li key={l.variantId} className="flex gap-3 p-4">
                <Link href={`/product/${encodeURIComponent(l.productSlug)}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {l.image && <img src={l.image} alt="" className="h-full w-full object-cover" />}
                </Link>
                <div className="flex flex-1 flex-col gap-1">
                  <Link href={`/product/${encodeURIComponent(l.productSlug)}`} className="font-medium hover:text-brand-700">{l.name}</Link>
                  {l.variantName && <span className="text-sm text-gray-500">{l.variantName}</span>}
                  <span className="text-sm">{fmt(l.price)}</span>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex items-center rounded-lg border">
                      <button className="px-3 py-1" onClick={() => setQty(l.variantId, l.quantity - 1)} aria-label="إنقاص">−</button>
                      <span className="w-8 text-center">{l.quantity}</span>
                      <button className="px-3 py-1" onClick={() => setQty(l.variantId, l.quantity + 1)} aria-label="زيادة">+</button>
                    </div>
                    <button className="text-sm text-red-600 hover:underline" onClick={() => remove(l.variantId)}>حذف</button>
                  </div>
                </div>
                <div className="font-semibold">{fmt(l.price * l.quantity)}</div>
              </li>
            ))}
          </ul>
          <aside className="card h-fit space-y-3 p-4">
            <div className="flex justify-between"><span>المجموع</span><span className="font-bold">{fmt(subtotal)}</span></div>
            <p className="text-xs text-gray-500">رسوم التوصيل تُحسب حسب المدينة في الخطوة التالية. الأسعار النهائية تُؤكَّد عند إرسال الطلب.</p>
            <Link href="/checkout" className="btn-primary w-full py-3">إتمام الطلب</Link>
          </aside>
        </div>
      )}
    </div>
  );
}
