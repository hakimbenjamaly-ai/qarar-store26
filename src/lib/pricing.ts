// حاسبة سعر البيع — منطق نقي بدون قاعدة بيانات لتسهيل الاختبار.
// سعر البيع = تكلفة الشراء + الشحن الدولي + الرسوم الإضافية + التوصيل المحلي (إن كان على المتجر) + هامش الربح

export type CostInput = {
  purchasePrice: number;
  purchaseRate: number; // دينار لكل وحدة من عملة الشراء
  shippingCost: number;
  shippingRate: number;
  otherFeesLyd: number;
  localDeliveryLyd: number;
  marginType: "PERCENT" | "FIXED";
  marginValue: number;
  roundTo?: number; // التقريب لأعلى إلى أقرب (مثلاً 0.5 أو 1)
};

export type CostBreakdown = {
  purchaseLyd: number;
  shippingLyd: number;
  otherFeesLyd: number;
  localDeliveryLyd: number;
  landedCost: number;
  margin: number;
  suggestedPrice: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcPrice(i: CostInput): CostBreakdown {
  const purchaseLyd = r2(i.purchasePrice * i.purchaseRate);
  const shippingLyd = r2(i.shippingCost * i.shippingRate);
  const landedCost = r2(purchaseLyd + shippingLyd + i.otherFeesLyd + i.localDeliveryLyd);
  const margin = r2(i.marginType === "PERCENT" ? (landedCost * i.marginValue) / 100 : i.marginValue);
  let suggestedPrice = r2(landedCost + margin);
  if (i.roundTo && i.roundTo > 0) suggestedPrice = r2(Math.ceil(suggestedPrice / i.roundTo - 1e-9) * i.roundTo);
  return { purchaseLyd, shippingLyd, otherFeesLyd: r2(i.otherFeesLyd), localDeliveryLyd: r2(i.localDeliveryLyd), landedCost, margin, suggestedPrice };
}

export function marginPercent(price: number, cost: number): number | null {
  if (cost <= 0) return null;
  return r2(((price - cost) / cost) * 100);
}
