import "server-only";
import { Prisma, type DeliveryStatus, type OrderStatus } from "@prisma/client";
import { db } from "./db";
import { syncItemsTx } from "./orders";
import { nextNumber } from "./numbering";
import { DELIVERY_STATUS_LABELS, deliveryNext, parseDeliveryStatus } from "./delivery-status";

export { DELIVERY_STATUS_LABELS, deliveryNext, deliveryTone, parseDeliveryStatus } from "./delivery-status";

const D = (n: number) => new Prisma.Decimal(n.toFixed(2));

const LIVE: OrderStatus[] = ["NEW", "CONFIRMING", "PURCHASING", "PURCHASED", "INTL_SHIPPING", "ARRIVED_LIBYA", "HANDED_TO_NAWRAS", "IN_DISTRIBUTION", "OUT_FOR_DELIVERY", "DELIVERY_FAILED"];
const IN_NAWRAS: OrderStatus[] = ["HANDED_TO_NAWRAS", "IN_DISTRIBUTION", "OUT_FOR_DELIVERY"];

/**
 * البنود الجاهزة للتجهيز: المستورد بعد وصوله إلى ليبيا، والمحلي بعد تأكيد الطلب،
 * ولا تتبع توصيلة فعّالة.
 */
const readyItemWhere: Prisma.OrderItemWhereInput = {
  OR: [
    { sourcing: "IMPORT_ON_ORDER", status: "ARRIVED_LIBYA" },
    { sourcing: "LOCAL_STOCK", status: "CONFIRMING" },
  ],
  deliveryItems: { none: { delivery: { status: { notIn: ["CANCELLED", "RETURNED"] } } } },
};

export async function readyQueue() {
  const orders = await db.order.findMany({
    where: { items: { some: readyItemWhere } },
    orderBy: { createdAt: "asc" },
    include: { items: true, payments: true },
  });
  return orders.map((o) => {
    const ready = o.items.filter(
      (i) => (i.sourcing === "IMPORT_ON_ORDER" ? i.status === "ARRIVED_LIBYA" : i.status === "CONFIRMING"),
    );
    const waiting = o.items.filter((i) => LIVE.includes(i.status) && !ready.includes(i) && !IN_NAWRAS.includes(i.status));
    return { order: o, ready, waiting };
  });
}

async function amountDue(tx: Prisma.TransactionClient, orderId: string) {
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true, deliveries: { where: { status: { notIn: ["CANCELLED", "RETURNED"] } } } } });
  const paid = o.payments.reduce((s, p) => s + (p.kind === "REFUND" ? -1 : 1) * Number(p.amount), 0);
  // ما ستحصّله توصيلات أخرى فعّالة لم تُسوَّ بعد (المسوّاة صارت دفعات)
  const pending = o.deliveries.filter((d) => !d.settlementId).reduce((s, d) => s + Number(d.status === "DELIVERED" ? (d.collected ?? 0) : d.codAmount), 0);
  return Math.max(0, Number(o.total) - paid - pending);
}

/** ينشئ توصيلة لكل طلب محدد من بنوده الجاهزة، بحالة «جاهز للتسليم» */
export async function createDeliveriesTx(tx: Prisma.TransactionClient, opts: { orderIds: string[]; partnerId: string; userId: string }) {
  const partner = await tx.deliveryPartner.findUniqueOrThrow({ where: { id: opts.partnerId } });
  const created: string[] = [];
  for (const orderId of opts.orderIds) {
    const items = await tx.orderItem.findMany({ where: { orderId, ...readyItemWhere } });
    if (items.length === 0) continue;
    const cod = await amountDue(tx, orderId);
    const number = await nextNumber(tx, "DLV");
    const d = await tx.delivery.create({
      data: {
        number,
        orderId,
        partnerId: partner.id,
        fee: partner.defaultFee,
        codAmount: D(cod),
        items: { create: items.map((i) => ({ orderItemId: i.id, quantity: i.quantity })) },
        events: { create: { status: "READY", note: "تجهيز الطرد", userId: opts.userId } },
      },
    });
    created.push(d.id);
  }
  return created;
}

export type DeliveryUpdate = {
  status?: DeliveryStatus | null;
  collected?: number | null;
  reason?: string;
  waybillNo?: string;
  courierName?: string;
  restock?: boolean;
  note?: string;
};

export class DeliveryError extends Error {}

/**
 * التحديث الموحد لحالة التوصيلة (من الإدارة أو بوابة النورس أو ملف الاستيراد)،
 * مع مزامنة حالات بنود الطلب والمخزون والإشعارات.
 */
export async function updateDeliveryTx(
  tx: Prisma.TransactionClient,
  deliveryId: string,
  u: DeliveryUpdate,
  actor: { userId: string | null; source: "admin" | "partner" | "import"; partnerId?: string | null },
) {
  const d = await tx.delivery.findUnique({ where: { id: deliveryId }, include: { items: { include: { orderItem: true } }, order: true } });
  if (!d) throw new DeliveryError("التوصيلة غير موجودة");
  if (actor.partnerId && d.partnerId !== actor.partnerId) throw new DeliveryError("التوصيلة لا تتبع شركتك");

  const fields: Prisma.DeliveryUpdateInput = {};
  if (u.waybillNo !== undefined && u.waybillNo !== "") fields.waybillNo = u.waybillNo;
  if (u.courierName !== undefined && u.courierName !== "") fields.courierName = u.courierName;

  const to = u.status && u.status !== d.status ? u.status : null;
  if (!to) {
    // تحديث بيانات فقط؛ يُسمح بتعديل المبلغ المحصل قبل التسوية
    if (u.collected != null && d.status === "DELIVERED") {
      if (d.settlementId) throw new DeliveryError("لا يمكن تعديل المبلغ بعد التسوية");
      fields.collected = D(u.collected);
    }
    if (Object.keys(fields).length) await tx.delivery.update({ where: { id: d.id }, data: fields });
    return { changed: false, number: d.number };
  }

  const allowed = deliveryNext(d.status, actor.source === "partner" ? "partner" : "admin");
  if (!allowed.includes(to)) throw new DeliveryError(`لا يمكن نقل ${d.number} من «${DELIVERY_STATUS_LABELS[d.status]}» إلى «${DELIVERY_STATUS_LABELS[to]}»`);
  if (to === "FAILED" && !u.reason?.trim()) throw new DeliveryError(`سبب تعذر التسليم مطلوب (${d.number})`);

  fields.status = to;
  const itemIds = d.items.map((i) => i.orderItemId);
  const note = [`التوصيلة ${d.number}`, u.reason || u.note].filter(Boolean).join(" – ");
  const sync = (s: OrderStatus, revertFrom?: OrderStatus[]) => syncItemsTx(tx, { itemIds, to: s, note, userId: actor.userId, revertFrom });

  switch (to) {
    case "IN_DISTRIBUTION":
      await sync("IN_DISTRIBUTION");
      break;
    case "OUT_FOR_DELIVERY":
      if (d.status === "FAILED") await sync("OUT_FOR_DELIVERY", ["DELIVERY_FAILED"]);
      else await sync("OUT_FOR_DELIVERY");
      fields.attempts = { increment: 1 };
      break;
    case "DELIVERED": {
      const collected = u.collected ?? Number(d.codAmount);
      if (collected < 0) throw new DeliveryError("مبلغ غير صحيح");
      fields.collected = D(collected);
      fields.deliveredAt = new Date();
      if (d.status !== "OUT_FOR_DELIVERY") fields.attempts = { increment: 1 };
      await sync("DELIVERED");
      for (const it of d.items) await tx.deliveryItem.update({ where: { id: it.id }, data: { deliveredQty: it.quantity } });
      if (Math.abs(collected - Number(d.codAmount)) >= 0.01) {
        await tx.notification.create({
          data: { event: "delivery.amount_mismatch", title: `فرق في المبلغ المحصّل ${d.number}`, body: `المطلوب ${Number(d.codAmount)} والمحصّل ${collected}`, link: `/admin/delivery/${d.id}` },
        });
      }
      break;
    }
    case "FAILED":
      fields.failureReason = u.reason!.trim();
      if (d.status !== "OUT_FOR_DELIVERY") fields.attempts = { increment: 1 };
      await sync("DELIVERY_FAILED", ["HANDED_TO_NAWRAS", "IN_DISTRIBUTION", "OUT_FOR_DELIVERY"]);
      await tx.notification.create({
        data: { event: "delivery.failed", title: `تعذر تسليم ${d.order.number}`, body: u.reason!.trim(), link: `/admin/delivery/${d.id}` },
      });
      break;
    case "RETURNED":
      await sync("RETURNED", ["DELIVERY_FAILED"]);
      for (const it of d.items) {
        await tx.return.create({ data: { orderItemId: it.orderItemId, deliveryId: d.id, quantity: it.quantity, reason: d.failureReason || u.note || "مرتجع من التوصيل", restocked: !!u.restock } });
        if (u.restock) {
          await tx.productVariant.update({ where: { id: it.orderItem.variantId }, data: { stockQty: { increment: it.quantity } } });
          await tx.inventoryMovement.create({ data: { variantId: it.orderItem.variantId, type: "RETURN", quantity: it.quantity, reference: d.number, note: "مرتجع من النورس", userId: actor.userId } });
        }
      }
      break;
    case "CANCELLED":
      break;
  }

  await tx.delivery.update({ where: { id: d.id }, data: fields });
  await tx.deliveryEvent.create({ data: { deliveryId: d.id, status: to, note: u.reason || u.note || "", source: actor.source, userId: actor.userId } });
  return { changed: true, number: d.number };
}

export async function updateDelivery(deliveryId: string, u: DeliveryUpdate, actor: Parameters<typeof updateDeliveryTx>[3]) {
  return db.$transaction((tx) => updateDeliveryTx(tx, deliveryId, u, actor));
}

/** توصيلات جاهزة للتسوية مع شريك: سُلّمت أو أُعيدت ولم تدخل تسوية */
export function settleCandidates(partnerId: string) {
  return db.delivery.findMany({
    where: { partnerId, settlementId: null, status: { in: ["DELIVERED", "RETURNED"] } },
    orderBy: { deliveredAt: "asc" },
    include: { order: { select: { id: true, number: true, shipName: true } } },
  });
}

/** دفعة تسليم: الطرود الجاهزة تُسلَّم لمندوب النورس بكشف موقّع */
export async function createHandoverTx(
  tx: Prisma.TransactionClient,
  opts: { partnerId: string; deliveryIds: string[]; receivedBy: string; notes: string; userId: string },
) {
  const ds = await tx.delivery.findMany({ where: { id: { in: opts.deliveryIds }, partnerId: opts.partnerId, status: "READY" }, include: { items: true } });
  if (ds.length === 0) throw new DeliveryError("اختر طروداً جاهزة لنفس الشركة");
  const number = await nextNumber(tx, "HND");
  const h = await tx.handover.create({
    data: { number, partnerId: opts.partnerId, handedAt: new Date(), receivedBy: opts.receivedBy, notes: opts.notes, parcelCount: ds.length },
  });
  for (const d of ds) {
    await tx.delivery.update({ where: { id: d.id }, data: { status: "HANDED_OVER", handoverId: h.id } });
    await tx.deliveryEvent.create({ data: { deliveryId: d.id, status: "HANDED_OVER", note: `دفعة ${number}${opts.receivedBy ? ` – استلمها ${opts.receivedBy}` : ""}`, userId: opts.userId } });
    await syncItemsTx(tx, { itemIds: d.items.map((i) => i.orderItemId), to: "HANDED_TO_NAWRAS", note: `دفعة التسليم ${number}`, userId: opts.userId });
  }
  return h;
}

/** صفوف ملف Excel للتوصيلات (للتسليم للنورس ولإعادته بالحالات المحدثة) */
export const DELIVERY_CSV_HEADER = [
  "رقم التوصيلة",
  "رقم الطلب",
  "اسم العميل",
  "الهاتف",
  "واتساب",
  "المدينة",
  "المنطقة",
  "العنوان",
  "أقرب نقطة دالة",
  "المحتوى",
  "المبلغ المطلوب تحصيله",
  "الحالة",
  "المبلغ المحصل",
  "سبب التعذر",
  "رقم البوليصة",
  "اسم المندوب",
];

export async function deliveryCsvRows(where: Prisma.DeliveryWhereInput) {
  const ds = await db.delivery.findMany({
    where,
    orderBy: { number: "asc" },
    include: { order: true, items: { include: { orderItem: true } } },
  });
  return ds.map((d) => [
    d.number,
    d.order.number,
    d.order.shipName,
    d.order.shipPhone,
    d.order.shipWhatsapp ?? "",
    d.order.shipCity,
    d.order.shipRegion,
    d.order.shipAddress,
    d.order.shipLandmark,
    d.items.map((i) => `${i.orderItem.productName}${i.orderItem.variantName ? ` (${i.orderItem.variantName})` : ""} × ${i.quantity}`).join(" + "),
    Number(d.codAmount),
    DELIVERY_STATUS_LABELS[d.status],
    d.collected === null ? "" : Number(d.collected),
    d.failureReason,
    d.waybillNo,
    d.courierName,
  ]);
}

export type ImportResult = { line: number; number: string; ok: boolean; message: string };

/** يطبّق ملف الحالات القادم من النورس صفاً صفاً؛ كل صف في معاملة مستقلة */
export async function importDeliveryCsv(rows: { line: number; get: (...n: string[]) => string }[], actor: { userId: string; source: "admin" | "partner"; partnerId?: string | null }) {
  const out: ImportResult[] = [];
  for (const r of rows) {
    const number = r.get("رقم التوصيلة", "delivery", "DLV");
    if (!number) {
      out.push({ line: r.line, number: "", ok: false, message: "رقم التوصيلة فارغ" });
      continue;
    }
    const d = await db.delivery.findUnique({ where: { number } });
    if (!d) {
      out.push({ line: r.line, number, ok: false, message: "رقم توصيلة غير معروف" });
      continue;
    }
    const statusText = r.get("الحالة", "status");
    const status = statusText ? parseDeliveryStatus(statusText) : null;
    if (statusText && !status) {
      out.push({ line: r.line, number, ok: false, message: `حالة غير معروفة: ${statusText}` });
      continue;
    }
    const collectedText = r.get("المبلغ المحصل", "collected").replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
    const collected = collectedText === "" ? null : Number(collectedText);
    if (collected !== null && (Number.isNaN(collected) || collected < 0)) {
      out.push({ line: r.line, number, ok: false, message: "المبلغ المحصل غير صحيح" });
      continue;
    }
    try {
      const res = await updateDelivery(
        d.id,
        { status, collected, reason: r.get("سبب التعذر", "reason"), waybillNo: r.get("رقم البوليصة", "waybill"), courierName: r.get("اسم المندوب", "courier") },
        { userId: actor.userId, source: actor.source === "partner" ? "partner" : "import", partnerId: actor.partnerId },
      );
      out.push({ line: r.line, number, ok: true, message: res.changed ? `← ${DELIVERY_STATUS_LABELS[status!]}` : "بدون تغيير في الحالة" });
    } catch (e) {
      out.push({ line: r.line, number, ok: false, message: e instanceof DeliveryError ? e.message : "خطأ غير متوقع" });
    }
  }
  return out;
}
