/** قوالب رسائل العملاء (واتساب / SMS) — تُرسل يدوياً من جهاز الموظف، لا يوجد ربط API. */

export type MsgTemplateKey = "order.confirmed" | "order.deposit" | "order.purchased" | "order.arrived" | "order.out_for_delivery" | "order.delivered" | "order.failed";

export const TEMPLATE_KEYS: MsgTemplateKey[] = ["order.confirmed", "order.deposit", "order.purchased", "order.arrived", "order.out_for_delivery", "order.delivered", "order.failed"];

export const TEMPLATE_LABELS: Record<MsgTemplateKey, string> = {
  "order.confirmed": "تأكيد الطلب",
  "order.deposit": "طلب العربون / المتبقي",
  "order.purchased": "تم الشراء من المورد",
  "order.arrived": "وصول الطلب إلى ليبيا",
  "order.out_for_delivery": "الطلب في الطريق",
  "order.delivered": "شكر بعد التسليم",
  "order.failed": "تعذّر التوصيل",
};

export const DEFAULT_TEMPLATES: Record<MsgTemplateKey, { ar: string; en: string }> = {
  "order.confirmed": {
    ar: "مرحباً {name}، تم تأكيد طلبك رقم {order} من {store} بإجمالي {total}. يمكنك متابعة حالته من هنا: {track_link}",
    en: "Hello {name}, your order {order} from {store} is confirmed. Total: {total}. Track it here: {track_link}",
  },
  "order.deposit": {
    ar: "مرحباً {name}، لاستكمال طلبك {order} يرجى سداد المبلغ المستحق {remaining}. شكراً لاختيارك {store}.",
    en: "Hello {name}, to proceed with order {order} please pay the outstanding amount of {remaining}. Thank you for choosing {store}.",
  },
  "order.purchased": {
    ar: "مرحباً {name}، تم شراء منتجات طلبك {order} من المورد وسنبلغك عند شحنها. المتابعة: {track_link}",
    en: "Hello {name}, the items in your order {order} have been purchased from the supplier. We'll update you when they ship: {track_link}",
  },
  "order.arrived": {
    ar: "مرحباً {name}، وصل طلبك {order} إلى ليبيا وسيتم تجهيزه للتوصيل قريباً. المبلغ المتبقي عند الاستلام: {remaining}.",
    en: "Hello {name}, your order {order} has arrived in Libya and will be prepared for delivery soon. Amount due on delivery: {remaining}.",
  },
  "order.out_for_delivery": {
    ar: "مرحباً {name}، طلبك {order} في الطريق إليك اليوم. يرجى تجهيز مبلغ {remaining} والرد على اتصال المندوب.",
    en: "Hello {name}, your order {order} is out for delivery today. Please have {remaining} ready and answer the courier's call.",
  },
  "order.delivered": {
    ar: "شكراً {name} على ثقتك في {store}! نتمنى أن ينال طلبك {order} إعجابك، ويسعدنا تقييمك: {track_link}",
    en: "Thank you {name} for shopping with {store}! We hope you enjoy order {order}. We'd love your review: {track_link}",
  },
  "order.failed": {
    ar: "مرحباً {name}، حاول المندوب توصيل طلبك {order} ولم يتمكن من الوصول إليك. يرجى الرد لتحديد موعد جديد.",
    en: "Hello {name}, our courier tried to deliver your order {order} but couldn't reach you. Please reply to arrange a new time.",
  },
};

export type MsgVars = { name: string; order: string; total: string; remaining: string; track_link: string; store: string };

export function renderTemplate(tpl: string, v: MsgVars): string {
  return tpl.replace(/\{(name|order|total|remaining|track_link|store)\}/g, (_, k: keyof MsgVars) => v[k] ?? "");
}

export function templateFor(custom: Record<string, { ar: string; en: string }> | undefined, key: MsgTemplateKey, l: "ar" | "en"): string {
  const c = custom?.[key]?.[l]?.trim();
  return c || DEFAULT_TEMPLATES[key][l];
}

/** يحوّل رقماً ليبياً إلى الصيغة الدولية بدون + (لروابط wa.me) */
export function intlPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("218")) return d;
  if (d.startsWith("0")) return "218" + d.slice(1);
  if (d.length === 9) return "218" + d;
  return d;
}

export function messageLink(channel: "whatsapp" | "sms", phone: string, body: string): string {
  if (channel === "whatsapp") return `https://wa.me/${intlPhone(phone)}?text=${encodeURIComponent(body)}`;
  return `sms:+${intlPhone(phone)}?body=${encodeURIComponent(body)}`;
}
