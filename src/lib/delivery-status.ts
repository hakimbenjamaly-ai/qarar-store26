import type { DeliveryStatus } from "@prisma/client";

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  READY: "جاهز للتسليم للنورس",
  HANDED_OVER: "سُلّم إلى النورس",
  IN_DISTRIBUTION: "قيد التوزيع",
  OUT_FOR_DELIVERY: "خرج للتوصيل",
  DELIVERED: "تم التسليم للعميل",
  FAILED: "تعذر التسليم",
  RETURNED: "عاد إلى المتجر",
  CANCELLED: "ملغى",
};

export function deliveryTone(s: DeliveryStatus) {
  if (s === "DELIVERED") return "bg-emerald-100 text-emerald-800";
  if (s === "FAILED") return "bg-red-100 text-red-800";
  if (s === "RETURNED" || s === "CANCELLED") return "bg-gray-200 text-gray-700";
  if (s === "READY") return "bg-amber-100 text-amber-800";
  return "bg-sky-100 text-sky-800";
}

/** الانتقالات المسموحة. التسليم للنورس يتم عبر «دفعة تسليم» فقط. */
export function deliveryNext(s: DeliveryStatus, actor: "admin" | "partner" = "admin"): DeliveryStatus[] {
  let out: DeliveryStatus[];
  switch (s) {
    case "READY":
      out = ["CANCELLED"];
      break;
    case "HANDED_OVER":
      out = ["IN_DISTRIBUTION", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"];
      break;
    case "IN_DISTRIBUTION":
      out = ["OUT_FOR_DELIVERY", "DELIVERED", "FAILED"];
      break;
    case "OUT_FOR_DELIVERY":
      out = ["DELIVERED", "FAILED"];
      break;
    case "FAILED":
      out = ["OUT_FOR_DELIVERY", "RETURNED"];
      break;
    default:
      out = [];
  }
  // موظف النورس لا يلغي ولا يؤكد استلام المرتجع في المتجر
  if (actor === "partner") out = out.filter((x) => x !== "CANCELLED" && x !== "RETURNED");
  return out;
}

/** يقبل رمز الحالة أو اسمها العربي (لملفات Excel القادمة من النورس) */
export function parseDeliveryStatus(v: string): DeliveryStatus | null {
  const t = v.trim();
  if (!t) return null;
  const up = t.toUpperCase();
  if (up in DELIVERY_STATUS_LABELS) return up as DeliveryStatus;
  const hit = (Object.entries(DELIVERY_STATUS_LABELS) as [DeliveryStatus, string][]).find(([, l]) => l === t);
  if (hit) return hit[0];
  const aliases: Record<string, DeliveryStatus> = {
    "تم التسليم": "DELIVERED",
    "سلم": "DELIVERED",
    "تم التوصيل": "DELIVERED",
    "تعذر": "FAILED",
    "لم يسلم": "FAILED",
    "خرج": "OUT_FOR_DELIVERY",
    "مع المندوب": "OUT_FOR_DELIVERY",
    "قيد التوزيع": "IN_DISTRIBUTION",
    "مرتجع": "RETURNED",
  };
  return aliases[t] ?? null;
}

