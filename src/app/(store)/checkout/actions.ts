"use server";

import { z } from "zod";
import { normalizePhone } from "@/lib/format";
import { placeOrder, OrderError } from "@/lib/orders";

const schema = z.object({
  fullName: z.string().trim().min(3, "الاسم الكامل مطلوب").max(100),
  phone: z.string().trim(),
  whatsapp: z.string().trim().optional(),
  cityId: z.string().min(1, "اختر المدينة"),
  region: z.string().trim().max(100).default(""),
  address: z.string().trim().min(5, "العنوان التفصيلي مطلوب").max(300),
  landmark: z.string().trim().max(200).default(""),
  note: z.string().trim().max(500).default(""),
  paymentMethodId: z.string().min(1, "اختر طريقة الدفع"),
  items: z.array(z.object({ variantId: z.string(), quantity: z.number().int() })).min(1, "السلة فارغة").max(50),
});

export type CheckoutResult = { ok: true; number: string; phone: string } | { ok: false; error: string };

export async function submitOrder(raw: unknown): Promise<CheckoutResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  const d = parsed.data;
  const phone = normalizePhone(d.phone);
  if (!phone) return { ok: false, error: "رقم الهاتف غير صحيح. اكتبه بصيغة 09XXXXXXXX" };
  let whatsapp: string | null = null;
  if (d.whatsapp) {
    whatsapp = normalizePhone(d.whatsapp);
    if (!whatsapp) return { ok: false, error: "رقم الواتساب غير صحيح" };
  }
  try {
    const order = await placeOrder({ ...d, phone, whatsapp });
    return { ok: true, number: order.number, phone };
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "تعذر إرسال الطلب، يرجى المحاولة مرة أخرى" };
  }
}
