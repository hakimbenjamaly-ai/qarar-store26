"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type OrderStatus, type PaymentKind } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { changeStatus, OrderError } from "@/lib/orders";
import { STATUS_LABELS } from "@/lib/order-status";
import { saveUpload } from "@/lib/uploads";
import { bool, flashRedirect, num, str } from "@/lib/action-utils";

const back = (id: string) => `/admin/orders/${id}`;

export async function updateStatus(fd: FormData) {
  const u = await requireUser("orders.manage");
  const orderId = str(fd, "orderId");
  const to = str(fd, "to") as OrderStatus;
  if (!(to in STATUS_LABELS)) flashRedirect(back(orderId), { err: "حالة غير صحيحة" });
  try {
    const r = await changeStatus({ orderId, itemId: str(fd, "itemId") || undefined, to, note: str(fd, "note"), userId: u.id, restock: bool(fd, "restock") });
    revalidatePath(back(orderId));
    flashRedirect(back(orderId), { ok: `تم تحديث ${r.moved} بند${r.skipped ? ` (تُرك ${r.skipped} بند لا ينطبق عليه الانتقال)` : ""}` });
  } catch (e) {
    if (e instanceof OrderError) flashRedirect(back(orderId), { err: e.message });
    throw e;
  }
}

export async function addPayment(fd: FormData) {
  const u = await requireUser("payments.manage");
  const orderId = str(fd, "orderId");
  const amount = num(fd, "amount");
  const kind = str(fd, "kind") as PaymentKind;
  if (!["DEPOSIT", "PAYMENT", "REFUND"].includes(kind) || amount <= 0) flashRedirect(back(orderId), { err: "أدخل مبلغاً صحيحاً ونوع الدفعة" });
  let receiptUrl: string | null = null;
  try {
    receiptUrl = await saveUpload(fd.get("receipt") as File | null, "receipts");
  } catch (e) {
    flashRedirect(back(orderId), { err: (e as Error).message });
  }
  const p = await db.payment.create({
    data: {
      orderId,
      kind,
      amount: new Prisma.Decimal(amount.toFixed(2)),
      methodId: str(fd, "methodId") || null,
      reference: str(fd, "reference"),
      note: str(fd, "note"),
      receiptUrl,
      receivedAt: str(fd, "receivedAt") ? new Date(str(fd, "receivedAt")) : new Date(),
      createdById: u.id,
    },
  });
  await audit(u.id, "create", "Payment", p.id, undefined, p);
  revalidatePath(back(orderId));
  flashRedirect(back(orderId), { ok: "تم تسجيل الدفعة" });
}

export async function deletePayment(fd: FormData) {
  const u = await requireUser("payments.manage");
  const id = str(fd, "id");
  const p = await db.payment.findUnique({ where: { id } });
  if (!p) flashRedirect("/admin/orders", { err: "الدفعة غير موجودة" });
  if (p.settlementId) flashRedirect(back(p.orderId), { err: "الدفعة مرتبطة بتسوية ولا يمكن حذفها" });
  await db.payment.delete({ where: { id } });
  await audit(u.id, "delete", "Payment", id, p);
  flashRedirect(back(p.orderId), { ok: "تم حذف الدفعة" });
}

export async function updateOrderInfo(fd: FormData) {
  const u = await requireUser("orders.manage");
  const id = str(fd, "orderId");
  const o = await db.order.findUnique({ where: { id } });
  if (!o) flashRedirect("/admin/orders", { err: "الطلب غير موجود" });
  const discount = Math.max(0, num(fd, "discount", Number(o.discount)));
  const deliveryFee = Math.max(0, num(fd, "deliveryFee", Number(o.deliveryFee)));
  const deposit = Math.max(0, num(fd, "depositRequired", Number(o.depositRequired)));
  const total = Number(o.subtotal) - discount + deliveryFee;
  if (total < 0) flashRedirect(back(id), { err: "الخصم أكبر من قيمة الطلب" });
  const data = {
    shipName: str(fd, "shipName") || o.shipName,
    shipWhatsapp: str(fd, "shipWhatsapp") || null,
    shipRegion: str(fd, "shipRegion"),
    shipAddress: str(fd, "shipAddress") || o.shipAddress,
    shipLandmark: str(fd, "shipLandmark"),
    internalNote: str(fd, "internalNote"),
    discount: new Prisma.Decimal(discount.toFixed(2)),
    deliveryFee: new Prisma.Decimal(deliveryFee.toFixed(2)),
    depositRequired: new Prisma.Decimal(deposit.toFixed(2)),
    total: new Prisma.Decimal(total.toFixed(2)),
  };
  await db.order.update({ where: { id }, data });
  await audit(u.id, "update", "Order", id, o, data);
  flashRedirect(back(id), { ok: "تم حفظ بيانات الطلب" });
}
