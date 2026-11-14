"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/format";

const schema = z.object({
  number: z.string().trim(),
  phone: z.string().trim(),
  productId: z.string(),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().max(1000).default(""),
});

export async function submitReview(_: unknown, fd: FormData): Promise<{ ok: boolean; msg: string }> {
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, msg: "اختر عدد النجوم" };
  const phone = normalizePhone(p.data.phone);
  const order = await db.order.findFirst({
    where: { number: p.data.number, shipPhone: phone ?? "-" },
    include: { items: { where: { status: "DELIVERED" }, include: { variant: { select: { productId: true } } } } },
  });
  if (!order || !order.items.some((i) => i.variant.productId === p.data.productId)) return { ok: false, msg: "لا يمكن تقييم هذا المنتج" };
  const exists = await db.review.findUnique({ where: { productId_orderId: { productId: p.data.productId, orderId: order.id } } });
  if (exists) return { ok: false, msg: "تم تقييم هذا المنتج مسبقاً" };
  await db.review.create({ data: { productId: p.data.productId, orderId: order.id, customerId: order.customerId, rating: p.data.rating, body: p.data.body } });
  revalidatePath("/track");
  return { ok: true, msg: "شكراً لك! سيظهر تقييمك بعد مراجعته." };
}
