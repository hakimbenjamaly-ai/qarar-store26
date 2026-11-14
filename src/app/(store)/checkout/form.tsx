"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/components/cart";
import { submitOrder } from "./actions";

type City = { id: string; name: string; fee: number; regions: string[] };
type Method = { id: string; name: string; instructions: string };
const fmt = (n: number) => `${n.toLocaleString("ar-LY", { maximumFractionDigits: 2 })} د.ل`;

export function CheckoutForm({ cities, methods, depositPercent }: { cities: City[]; methods: Method[]; depositPercent: number }) {
  const { lines, ready, subtotal, clear } = useCart();
  const router = useRouter();
  const [cityId, setCityId] = useState("");
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const city = cities.find((c) => c.id === cityId);
  const method = methods.find((m) => m.id === methodId);

  if (!ready) return null;
  if (lines.length === 0)
    return (
      <div className="card p-8 text-center">
        <p className="mb-4 text-gray-600">السلة فارغة.</p>
        <Link href="/" className="btn-primary">تابع التسوق</Link>
      </div>
    );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const payload = {
      fullName: String(f.get("fullName") ?? ""),
      phone: String(f.get("phone") ?? ""),
      whatsapp: String(f.get("whatsapp") ?? "") || undefined,
      cityId,
      region: String(f.get("region") ?? ""),
      address: String(f.get("address") ?? ""),
      landmark: String(f.get("landmark") ?? ""),
      note: String(f.get("note") ?? ""),
      paymentMethodId: methodId,
      items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
    };
    start(async () => {
      const r = await submitOrder(payload);
      if (!r.ok) return setError(r.error);
      clear();
      router.push(`/track?n=${encodeURIComponent(r.number)}&p=${encodeURIComponent(r.phone)}&new=1`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="card space-y-4 p-5">
        <h2 className="font-bold">بيانات الاستلام</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="fullName">الاسم الكامل *</label>
            <input id="fullName" name="fullName" required minLength={3} className="input" autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="phone">رقم الهاتف *</label>
            <input id="phone" name="phone" required dir="ltr" placeholder="09XXXXXXXX" className="input text-right" inputMode="tel" autoComplete="tel" />
          </div>
          <div>
            <label className="label" htmlFor="whatsapp">رقم واتساب (إن كان مختلفاً)</label>
            <input id="whatsapp" name="whatsapp" dir="ltr" placeholder="09XXXXXXXX" className="input text-right" inputMode="tel" />
          </div>
          <div>
            <label className="label" htmlFor="city">المدينة *</label>
            <select id="city" required value={cityId} onChange={(e) => setCityId(e.target.value)} className="input">
              <option value="">اختر المدينة</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="region">المنطقة</label>
            {city && city.regions.length > 0 ? (
              <select id="region" name="region" className="input">
                <option value="">اختر المنطقة</option>
                {city.regions.map((r) => <option key={r}>{r}</option>)}
              </select>
            ) : (
              <input id="region" name="region" className="input" />
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="address">العنوان التفصيلي *</label>
            <input id="address" name="address" required minLength={5} className="input" placeholder="الشارع، المبنى..." />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="landmark">أقرب نقطة دالة</label>
            <input id="landmark" name="landmark" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="note">ملاحظات على الطلب</label>
            <textarea id="note" name="note" rows={2} className="input" />
          </div>
        </div>
        <h2 className="pt-2 font-bold">طريقة الدفع</h2>
        <div className="space-y-2">
          {methods.map((m) => (
            <label key={m.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${m.id === methodId ? "border-brand-600 bg-brand-50" : ""}`}>
              <input type="radio" name="method" checked={m.id === methodId} onChange={() => setMethodId(m.id)} />
              <span>
                <span className="font-medium">{m.name}</span>
                {m.instructions && m.id === methodId && <span className="mt-1 block whitespace-pre-line text-sm text-gray-600">{m.instructions}</span>}
              </span>
            </label>
          ))}
        </div>
      </div>
      <aside className="card h-fit space-y-3 p-5">
        <h2 className="font-bold">ملخص الطلب</h2>
        <ul className="space-y-2 text-sm">
          {lines.map((l) => (
            <li key={l.variantId} className="flex justify-between gap-2">
              <span>{l.name}{l.variantName ? ` (${l.variantName})` : ""} × {l.quantity}</span>
              <span>{fmt(l.price * l.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between"><span>المجموع</span><span>{fmt(subtotal)}</span></div>
          <div className="flex justify-between"><span>التوصيل</span><span>{city ? (city.fee > 0 ? fmt(city.fee) : "مجاني") : "اختر المدينة"}</span></div>
          <div className="flex justify-between text-base font-bold"><span>الإجمالي</span><span>{fmt(subtotal + (city?.fee ?? 0))}</span></div>
        </div>
        {depositPercent > 0 && <p className="text-xs text-gray-500">المنتجات المطلوبة من الخارج تتطلب عربوناً بنسبة {depositPercent}% من قيمتها، وسنتواصل معك لتأكيده.</p>}
        {method && <p className="text-xs text-gray-500">الدفع: {method.name}</p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={pending} className="btn-primary w-full py-3 text-base">{pending ? "جارٍ الإرسال..." : "تأكيد الطلب"}</button>
        <p className="text-xs text-gray-500">بتأكيد الطلب أنت توافق على <Link href="/policies" className="underline">سياسة الشراء والاسترجاع</Link>.</p>
      </aside>
    </form>
  );
}
