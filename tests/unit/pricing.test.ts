import { describe, expect, it } from "vitest";
import { calcPrice, marginPercent } from "@/lib/pricing";

describe("calcPrice", () => {
  it("يجمع التكاليف ويضيف هامش النسبة", () => {
    const r = calcPrice({ purchasePrice: 10, purchaseRate: 7, shippingCost: 2, shippingRate: 7, otherFeesLyd: 5, localDeliveryLyd: 0, marginType: "PERCENT", marginValue: 20 });
    expect(r.purchaseLyd).toBe(70);
    expect(r.shippingLyd).toBe(14);
    expect(r.landedCost).toBe(89);
    expect(r.margin).toBe(17.8);
    expect(r.suggestedPrice).toBe(106.8);
  });
  it("يدعم الهامش الثابت والتقريب لأعلى", () => {
    const r = calcPrice({ purchasePrice: 3.1, purchaseRate: 7.2, shippingCost: 0, shippingRate: 1, otherFeesLyd: 0, localDeliveryLyd: 5, marginType: "FIXED", marginValue: 10, roundTo: 5 });
    expect(r.landedCost).toBe(27.32);
    expect(r.suggestedPrice).toBe(40);
  });
  it("لا يقرّب سعراً مضبوطاً لأعلى بالخطأ", () => {
    const r = calcPrice({ purchasePrice: 10, purchaseRate: 1, shippingCost: 0, shippingRate: 1, otherFeesLyd: 0, localDeliveryLyd: 0, marginType: "FIXED", marginValue: 0, roundTo: 0.5 });
    expect(r.suggestedPrice).toBe(10);
  });
  it("marginPercent", () => {
    expect(marginPercent(120, 100)).toBe(20);
    expect(marginPercent(10, 0)).toBeNull();
  });
});
