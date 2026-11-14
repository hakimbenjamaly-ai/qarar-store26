import { describe, expect, it } from "vitest";
import { allowedNext, deriveOrderStatus } from "@/lib/order-status";

describe("deriveOrderStatus", () => {
  it("يأخذ أبطأ بند", () => {
    expect(deriveOrderStatus(["OUT_FOR_DELIVERY", "INTL_SHIPPING"])).toBe("INTL_SHIPPING");
  });
  it("يتجاهل الملغى إلا إذا أُلغي الكل", () => {
    expect(deriveOrderStatus(["CANCELLED", "DELIVERED"])).toBe("DELIVERED");
    expect(deriveOrderStatus(["CANCELLED", "CANCELLED"])).toBe("CANCELLED");
  });
  it("يُظهر التعثر", () => {
    expect(deriveOrderStatus(["DELIVERED", "DELIVERY_FAILED"])).toBe("DELIVERY_FAILED");
  });
  it("المرتجع بالكامل", () => {
    expect(deriveOrderStatus(["RETURNED", "CANCELLED"])).toBe("RETURNED");
  });
});

describe("allowedNext", () => {
  it("البند المحلي يتخطى مراحل الاستيراد", () => {
    const n = allowedNext("CONFIRMING", "LOCAL_STOCK");
    expect(n).not.toContain("PURCHASING");
    expect(n).toContain("HANDED_TO_NAWRAS");
    expect(n).toContain("CANCELLED");
  });
  it("لا إلغاء بعد الشراء، بل إرجاع", () => {
    const n = allowedNext("PURCHASED", "IMPORT_ON_ORDER");
    expect(n).not.toContain("CANCELLED");
    expect(n).toContain("RETURNED");
  });
  it("الحالات النهائية", () => {
    expect(allowedNext("CANCELLED", "LOCAL_STOCK")).toEqual([]);
    expect(allowedNext("DELIVERED", "LOCAL_STOCK")).toEqual(["RETURNED"]);
  });
});
