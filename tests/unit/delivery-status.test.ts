import { describe, expect, it } from "vitest";
import { deliveryNext, parseDeliveryStatus } from "@/lib/delivery-status";

describe("delivery status", () => {
  it("التجهيز لا ينتقل إلا بالإلغاء (التسليم للنورس عبر دفعة)", () => {
    expect(deliveryNext("READY")).toEqual(["CANCELLED"]);
  });
  it("التعذر يعاد للتوصيل أو يعود للمتجر", () => {
    expect(deliveryNext("FAILED")).toEqual(["OUT_FOR_DELIVERY", "RETURNED"]);
  });
  it("موظف النورس لا يلغي ولا يؤكد المرتجع", () => {
    expect(deliveryNext("FAILED", "partner")).toEqual(["OUT_FOR_DELIVERY"]);
    expect(deliveryNext("READY", "partner")).toEqual([]);
  });
  it("الحالات النهائية", () => {
    expect(deliveryNext("DELIVERED")).toEqual([]);
    expect(deliveryNext("RETURNED")).toEqual([]);
  });
  it("يقرأ الحالة بالرمز أو بالعربية", () => {
    expect(parseDeliveryStatus("delivered")).toBe("DELIVERED");
    expect(parseDeliveryStatus("تم التسليم للعميل")).toBe("DELIVERED");
    expect(parseDeliveryStatus("تعذر")).toBe("FAILED");
    expect(parseDeliveryStatus("")).toBeNull();
    expect(parseDeliveryStatus("شيء آخر")).toBeNull();
  });
});
