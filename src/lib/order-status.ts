import type { OrderStatus } from "@prisma/client";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "طلب جديد",
  CONFIRMING: "قيد تأكيد الطلب",
  PURCHASING: "قيد الشراء من المورد",
  PURCHASED: "تم شراء المنتج",
  INTL_SHIPPING: "قيد الشحن الدولي",
  ARRIVED_LIBYA: "وصل إلى ليبيا",
  HANDED_TO_NAWRAS: "تم تسليمه إلى النورس",
  IN_DISTRIBUTION: "قيد التوزيع",
  OUT_FOR_DELIVERY: "خرج للتوصيل",
  DELIVERED: "تم التسليم للعميل",
  DELIVERY_FAILED: "تعذر التسليم",
  RETURNED: "طلب مرتجع",
  CANCELLED: "طلب ملغى",
};

// ترتيب التقدم في المسار الطبيعي
export const PROGRESS: OrderStatus[] = [
  "NEW",
  "CONFIRMING",
  "PURCHASING",
  "PURCHASED",
  "INTL_SHIPPING",
  "ARRIVED_LIBYA",
  "HANDED_TO_NAWRAS",
  "IN_DISTRIBUTION",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export const TERMINAL: OrderStatus[] = ["DELIVERED", "RETURNED", "CANCELLED"];
const IMPORT_ONLY: OrderStatus[] = ["PURCHASING", "PURCHASED", "INTL_SHIPPING", "ARRIVED_LIBYA"];

/** الحالات المسموح الانتقال إليها من حالة معينة. البنود المحلية تتخطى مراحل الاستيراد. */
export function allowedNext(from: OrderStatus, sourcing: "LOCAL_STOCK" | "IMPORT_ON_ORDER"): OrderStatus[] {
  if (from === "CANCELLED" || from === "RETURNED") return [];
  if (from === "DELIVERED") return ["RETURNED"];
  if (from === "DELIVERY_FAILED") return ["OUT_FOR_DELIVERY", "IN_DISTRIBUTION", "RETURNED", "CANCELLED"];
  const idx = PROGRESS.indexOf(from);
  let forward = PROGRESS.slice(idx + 1);
  if (sourcing === "LOCAL_STOCK") forward = forward.filter((s) => !IMPORT_ONLY.includes(s));
  const out: OrderStatus[] = [...forward];
  if (idx >= PROGRESS.indexOf("HANDED_TO_NAWRAS")) out.push("DELIVERY_FAILED");
  // الإلغاء متاح قبل شراء المنتج فقط، بعده يُعامل كمرتجع
  if (idx < PROGRESS.indexOf("PURCHASED")) out.push("CANCELLED");
  else out.push("RETURNED");
  return out;
}

/**
 * حالة الطلب الظاهرة = أبطأ بند فيه (البنود الملغاة لا تُحسب إلا إذا أُلغي الكل).
 * بند متعثر (تعذر التسليم) يظهر على الطلب لأنه يحتاج تدخلاً.
 */
export function deriveOrderStatus(items: OrderStatus[]): OrderStatus {
  if (items.length === 0) return "NEW";
  const live = items.filter((s) => s !== "CANCELLED");
  if (live.length === 0) return "CANCELLED";
  if (live.includes("DELIVERY_FAILED")) return "DELIVERY_FAILED";
  const progressing = live.filter((s) => s !== "RETURNED");
  if (progressing.length === 0) return "RETURNED";
  return progressing.reduce((min, s) => (PROGRESS.indexOf(s) < PROGRESS.indexOf(min) ? s : min));
}

export function statusTone(s: OrderStatus): string {
  if (s === "DELIVERED") return "bg-emerald-100 text-emerald-800";
  if (s === "CANCELLED" || s === "RETURNED") return "bg-gray-200 text-gray-700";
  if (s === "DELIVERY_FAILED") return "bg-red-100 text-red-800";
  if (s === "NEW") return "bg-amber-100 text-amber-800";
  return "bg-sky-100 text-sky-800";
}
