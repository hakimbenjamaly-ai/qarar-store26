import type { Prisma } from "@prisma/client";

/** يولّد رقماً متسلسلاً مثل ORD-2026-00001 داخل معاملة قاعدة البيانات */
export async function nextNumber(tx: Prisma.TransactionClient, prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const key = `${prefix}-${year}`;
  const c = await tx.counter.upsert({ where: { key }, create: { key, value: 1 }, update: { value: { increment: 1 } } });
  return `${key}-${String(c.value).padStart(5, "0")}`;
}
