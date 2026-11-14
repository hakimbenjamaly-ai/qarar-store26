"use client";

import { useState } from "react";
import { calcPrice } from "@/lib/pricing";

import { emptyVariant, type VariantRow } from "@/lib/variant-row";

const n = (s: string) => Number(s) || 0;
const fmt = (x: number) => x.toLocaleString("ar-LY", { maximumFractionDigits: 2 });

export function VariantsEditor({
  initial,
  rates,
  roundTo,
  showCosts,
  local,
  baseSku,
}: {
  initial: VariantRow[];
  rates: Record<string, number>;
  roundTo: number;
  showCosts: boolean;
  local: boolean;
  baseSku: string;
}) {
  const [rows, setRows] = useState<VariantRow[]>(initial.length ? initial : [emptyVariant()]);
  const [open, setOpen] = useState<number | null>(showCosts ? 0 : null);
  const currencies = Object.keys(rates);

  const set = (i: number, patch: Partial<VariantRow>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const setCost = (i: number, patch: Partial<VariantRow["cost"]>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, cost: { ...x.cost, ...patch } } : x)));

  return (
    <div className="space-y-3">
      <input type="hidden" name="variants" value={JSON.stringify(rows)} />
      {rows.map((v, i) => {
        const pr = rates[v.cost.purchaseCurrency];
        const sr = rates[v.cost.shippingCurrency];
        const missingRate = pr === undefined || sr === undefined;
        const b = missingRate
          ? null
          : calcPrice({
              purchasePrice: n(v.cost.purchasePrice),
              purchaseRate: pr,
              shippingCost: n(v.cost.shippingCost),
              shippingRate: sr,
              otherFeesLyd: n(v.cost.otherFeesLyd),
              localDeliveryLyd: n(v.cost.localDeliveryLyd),
              marginType: v.cost.marginType,
              marginValue: n(v.cost.marginValue),
              roundTo,
            });
        const actualMargin = b && n(v.price) > 0 ? n(v.price) - b.landedCost : null;
        return (
          <div key={i} className="rounded-lg border bg-gray-50 p-3">
            <div className="grid gap-2 text-sm sm:grid-cols-4 lg:grid-cols-8">
              <input value={v.sku} onChange={(e) => set(i, { sku: e.target.value })} placeholder={`SKU ${baseSku ? `(${baseSku}-${i + 1})` : ""}`} dir="ltr" className="input" aria-label="SKU" />
              <input value={v.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="اسم الخيار (مثلاً أحمر / XL)" className="input sm:col-span-2" aria-label="اسم الخيار" />
              <input value={v.color} onChange={(e) => set(i, { color: e.target.value })} placeholder="اللون" className="input" aria-label="اللون" />
              <input value={v.size} onChange={(e) => set(i, { size: e.target.value })} placeholder="المقاس" className="input" aria-label="المقاس" />
              <input value={v.price} onChange={(e) => set(i, { price: e.target.value })} placeholder="سعر البيع د.ل *" inputMode="decimal" className="input font-semibold" aria-label="سعر البيع" required />
              <input value={v.compareAtPrice} onChange={(e) => set(i, { compareAtPrice: e.target.value })} placeholder="السعر قبل الخصم" inputMode="decimal" className="input" aria-label="السعر قبل الخصم" />
              <input value={v.stockQty} onChange={(e) => set(i, { stockQty: e.target.value })} placeholder="الكمية" inputMode="numeric" className="input" aria-label="الكمية المتاحة محلياً" title={local ? "الكمية المتاحة في ليبيا" : "غير مستخدمة للمنتجات المستوردة عند الطلب"} disabled={!local} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
              <label className="flex items-center gap-1"><input type="checkbox" checked={v.active} onChange={(e) => set(i, { active: e.target.checked })} /> متاح للبيع</label>
              {showCosts && <button type="button" className="text-brand-700 hover:underline" onClick={() => setOpen(open === i ? null : i)}>{open === i ? "إخفاء" : "إظهار"} التكلفة وحاسبة السعر</button>}
              {rows.length > 1 && <button type="button" className="text-red-600 hover:underline" onClick={() => setRows((r) => r.filter((_, k) => k !== i))}>حذف الخيار</button>}
            </div>
            {showCosts && open === i && (
              <div className="mt-3 grid gap-3 rounded-lg border bg-white p-3 text-sm lg:grid-cols-[1fr_260px]">
                <div className="grid gap-2 sm:grid-cols-4">
                  <label className="sm:col-span-2">سعر الشراء من المورد
                    <div className="flex gap-1">
                      <input value={v.cost.purchasePrice} onChange={(e) => setCost(i, { purchasePrice: e.target.value })} inputMode="decimal" className="input" />
                      <select value={v.cost.purchaseCurrency} onChange={(e) => setCost(i, { purchaseCurrency: e.target.value })} className="input w-24">
                        {[...new Set([...currencies, v.cost.purchaseCurrency])].map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </label>
                  <label className="sm:col-span-2">الشحن الدولي للوحدة
                    <div className="flex gap-1">
                      <input value={v.cost.shippingCost} onChange={(e) => setCost(i, { shippingCost: e.target.value })} inputMode="decimal" className="input" />
                      <select value={v.cost.shippingCurrency} onChange={(e) => setCost(i, { shippingCurrency: e.target.value })} className="input w-24">
                        {[...new Set([...currencies, v.cost.shippingCurrency])].map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </label>
                  <label className="sm:col-span-2">رسوم وتكاليف أخرى (د.ل)
                    <input value={v.cost.otherFeesLyd} onChange={(e) => setCost(i, { otherFeesLyd: e.target.value })} inputMode="decimal" className="input" />
                  </label>
                  <label className="sm:col-span-2">التوصيل المحلي إن كان على المتجر (د.ل)
                    <input value={v.cost.localDeliveryLyd} onChange={(e) => setCost(i, { localDeliveryLyd: e.target.value })} inputMode="decimal" className="input" />
                  </label>
                  <label className="sm:col-span-2">هامش الربح
                    <div className="flex gap-1">
                      <input value={v.cost.marginValue} onChange={(e) => setCost(i, { marginValue: e.target.value })} inputMode="decimal" className="input" />
                      <select value={v.cost.marginType} onChange={(e) => setCost(i, { marginType: e.target.value as "PERCENT" | "FIXED" })} className="input w-28">
                        <option value="PERCENT">%</option>
                        <option value="FIXED">د.ل ثابت</option>
                      </select>
                    </div>
                  </label>
                </div>
                <div className="rounded-lg bg-brand-50 p-3">
                  {missingRate ? (
                    <p className="text-red-700">لا يوجد سعر صرف مسجل لـ {pr === undefined ? v.cost.purchaseCurrency : v.cost.shippingCurrency}. أضفه من الإعدادات ← أسعار الصرف.</p>
                  ) : (
                    b && (
                      <dl className="space-y-1">
                        <div className="flex justify-between"><dt>الشراء</dt><dd>{fmt(b.purchaseLyd)}</dd></div>
                        <div className="flex justify-between"><dt>الشحن</dt><dd>{fmt(b.shippingLyd)}</dd></div>
                        <div className="flex justify-between"><dt>رسوم + توصيل</dt><dd>{fmt(b.otherFeesLyd + b.localDeliveryLyd)}</dd></div>
                        <div className="flex justify-between font-semibold"><dt>التكلفة النهائية</dt><dd>{fmt(b.landedCost)}</dd></div>
                        <div className="flex justify-between"><dt>الهامش</dt><dd>{fmt(b.margin)}</dd></div>
                        <div className="flex justify-between text-base font-bold text-brand-700"><dt>السعر المقترح</dt><dd>{fmt(b.suggestedPrice)} د.ل</dd></div>
                        {actualMargin !== null && <div className={`flex justify-between text-xs ${actualMargin < 0 ? "text-red-600" : "text-gray-600"}`}><dt>ربح السعر الحالي</dt><dd>{fmt(actualMargin)}</dd></div>}
                        <button type="button" className="btn-primary mt-2 w-full" onClick={() => set(i, { price: String(b.suggestedPrice) })}>اعتماد السعر المقترح</button>
                      </dl>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      <button type="button" className="btn-outline" onClick={() => { setRows((r) => [...r, { ...emptyVariant(), cost: { ...(rows[rows.length - 1]?.cost ?? emptyVariant().cost) } }]); setOpen(rows.length); }}>
        + إضافة خيار (مقاس / لون)
      </button>
    </div>
  );
}
