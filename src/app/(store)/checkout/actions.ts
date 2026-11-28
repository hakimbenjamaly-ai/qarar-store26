"use server";

import { z } from "zod";
import { normalizePhone } from "@/lib/format";
import { placeOrder, OrderError } from "@/lib/orders";
import { getLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";

const schema = z.object({
  fullName: z.string().trim().min(3, "errName").max(100),
  phone: z.string().trim(),
  whatsapp: z.string().trim().optional(),
  cityId: z.string().min(1, "errCity"),
  region: z.string().trim().max(100).default(""),
  address: z.string().trim().min(5, "errAddress").max(300),
  landmark: z.string().trim().max(200).default(""),
  note: z.string().trim().max(500).default(""),
  paymentMethodId: z.string().min(1, "errMethod"),
  items: z.array(z.object({ variantId: z.string(), quantity: z.number().int() })).min(1, "errEmptyCart").max(50),
});

export type CheckoutResult = { ok: true; number: string; phone: string } | { ok: false; error: string };

export async function submitOrder(raw: unknown): Promise<CheckoutResult> {
  const locale = await getLocale();
  const t = dict(locale);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const key = parsed.error.issues[0]?.message as keyof typeof t;
    const msg = typeof t[key] === "string" ? (t[key] as string) : t.errInvalid;
    return { ok: false, error: msg };
  }
  const d = parsed.data;
  const phone = normalizePhone(d.phone);
  if (!phone) return { ok: false, error: t.errPhone };
  let whatsapp: string | null = null;
  if (d.whatsapp) {
    whatsapp = normalizePhone(d.whatsapp);
    if (!whatsapp) return { ok: false, error: t.errWhatsapp };
  }
  try {
    const order = await placeOrder({ ...d, phone, whatsapp, locale });
    return { ok: true, number: order.number, phone };
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: locale === "en" && e.en ? e.en : e.message };
    console.error(e);
    return { ok: false, error: t.errOrderFailed };
  }
}
