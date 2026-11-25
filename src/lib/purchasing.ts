import "server-only";
import { Prisma, type ShipmentStatus } from "@prisma/client";
import { db } from "./db";
import { syncItemsTx } from "./orders";

const D = (n: number) => new Prisma.Decimal(n.toFixed(2));
const r2 = (n: number) => Math.round(n * 100) / 100;

export const PO_STATUS_LABELS = {
  DRAFT: "مسودة",
  ORDERED: "تم الطلب من المورد",
  PARTIALLY_SHIPPED: "شُحن جزئياً",
  SHIPPED: "شُحن بالكامل",
  CANCELLED: "ملغى",
} as const;

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: "قيد التجهيز",
  IN_TRANSIT: "في الطريق",
  CUSTOMS: "في الجمارك",
  ARRIVED_LIBYA: "وصلت إلى ليبيا",
  RECEIVED: "تم الاستلام والفرز",
  CANCELLED: "ملغاة",
};

/** الانتقالات المسموحة لحالة الشحنة. الاستلام نهائي لأنه يضيف للمخزون. */
export function shipmentNext(s: ShipmentStatus): ShipmentStatus[] {
  switch (s) {
    case "PENDING":
      return ["IN_TRANSIT", "CANCELLED"];
    case "IN_TRANSIT":
      return ["CUSTOMS", "ARRIVED_LIBYA"];
    case "CUSTOMS":
      return ["ARRIVED_LIBYA"];
    case "ARRIVED_LIBYA":
      return ["RECEIVED"];
    default:
      return [];
  }
}

/** بنود طلبات العملاء المستوردة التي نُقلت إلى «قيد الشراء» ولا يوجد لها أمر شراء فعّال */
export async function purchaseQueue() {
  return db.orderItem.findMany({
    where: {
      sourcing: "IMPORT_ON_ORDER",
      status: "PURCHASING",
      purchaseItems: { none: { purchaseOrder: { status: { not: "CANCELLED" } } } },
    },
    orderBy: { order: { createdAt: "asc" } },
    include: {
      order: { select: { id: true, number: true, createdAt: true, shipName: true } },
      variant: {
        include: {
          cost: true,
          supplierProducts: { include: { supplier: true } },
          product: { select: { id: true, name: true } },
        },
      },
    },
  });
}

/** يعيد حساب إجمالي أمر الشراء والتكلفة الواصلة لكل بند، وينقلها لبنود طلبات العملاء */
export async function recalcPurchaseOrderTx(tx: Prisma.TransactionClient, poId: string) {
  const po = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: { items: { include: { shipmentItems: true } } } });
  if (!po) return;
  const total = po.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
  await tx.purchaseOrder.update({ where: { id: poId }, data: { total: D(total) } });
  const rate = po.exchangeRate ? Number(po.exchangeRate) : null;
  for (const it of po.items) {
    let landed: number | null = null;
    if (rate !== null) {
      const shipping = it.shipmentItems.reduce((s, si) => s + (si.allocatedCostLyd ? Number(si.allocatedCostLyd) : 0), 0);
      landed = r2(Number(it.unitPrice) * rate + shipping / Math.max(1, it.quantity));
    }
    await tx.purchaseOrderItem.update({ where: { id: it.id }, data: { landedUnitCostLyd: landed === null ? null : D(landed) } });
    if (it.orderItemId) await tx.orderItem.update({ where: { id: it.orderItemId }, data: { actualUnitCostLyd: landed === null ? null : D(landed) } });
  }
}

/** حالة الشحن لأمر الشراء من الكميات المضافة لشحنات غير ملغاة */
export async function refreshPoShippingStatusTx(tx: Prisma.TransactionClient, poId: string) {
  const po = await tx.purchaseOrder.findUnique({
    where: { id: poId },
    include: { items: { include: { shipmentItems: { where: { shipment: { status: { not: "CANCELLED" } } } } } } },
  });
  if (!po || po.status === "DRAFT" || po.status === "CANCELLED") return;
  const ordered = po.items.reduce((s, i) => s + i.quantity, 0);
  const shipped = po.items.reduce((s, i) => s + i.shipmentItems.reduce((a, b) => a + b.quantity, 0), 0);
  const status = shipped === 0 ? "ORDERED" : shipped >= ordered ? "SHIPPED" : "PARTIALLY_SHIPPED";
  if (status !== po.status) await tx.purchaseOrder.update({ where: { id: poId }, data: { status } });
}

/**
 * يوزّع تكلفة الشحنة (الشحن × سعر الصرف + الجمارك) على بنودها حسب القيمة أو الكمية.
 * يعيد رسالة تحذير إن تعذّر الحساب (مثل غياب سعر صرف).
 */
export async function allocateShipmentTx(tx: Prisma.TransactionClient, shipmentId: string): Promise<string | null> {
  const sh = await tx.shipment.findUnique({
    where: { id: shipmentId },
    include: { items: { include: { purchaseOrderItem: { include: { purchaseOrder: true } } } } },
  });
  if (!sh || sh.items.length === 0) return null;
  const costLyd = Number(sh.cost) > 0 ? (sh.costCurrency === "LYD" ? Number(sh.cost) : sh.exchangeRate ? Number(sh.cost) * Number(sh.exchangeRate) : null) : 0;
  let warning: string | null = null;
  if (costLyd === null) warning = "لم تُوزَّع تكلفة الشحن: أدخل سعر صرف عملة الشحن";
  const total = (costLyd ?? 0) + Number(sh.customsFeesLyd);

  const weights = sh.items.map((si) => {
    if (sh.allocation === "BY_QUANTITY") return si.quantity;
    const rate = si.purchaseOrderItem.purchaseOrder.exchangeRate;
    if (!rate) return null;
    return Number(si.purchaseOrderItem.unitPrice) * si.quantity * Number(rate);
  });
  if (weights.some((w) => w === null)) {
    warning = "لم تُوزَّع التكلفة حسب القيمة: بعض أوامر الشراء بلا سعر صرف. استخدم التوزيع حسب الكمية أو أكمل أسعار الصرف";
    for (const si of sh.items) await tx.shipmentItem.update({ where: { id: si.id }, data: { allocatedCostLyd: null } });
  } else {
    const sum = (weights as number[]).reduce((a, b) => a + b, 0) || 1;
    let assigned = 0;
    for (const [k, si] of sh.items.entries()) {
      const share = k === sh.items.length - 1 ? r2(total - assigned) : r2((total * (weights[k] as number)) / sum);
      assigned = r2(assigned + share);
      await tx.shipmentItem.update({ where: { id: si.id }, data: { allocatedCostLyd: D(share) } });
    }
  }
  for (const poId of new Set(sh.items.map((si) => si.purchaseOrderItem.purchaseOrderId))) await recalcPurchaseOrderTx(tx, poId);
  return warning;
}

/** يطبّق أثر تغيير حالة الشحنة على بنود طلبات العملاء والمخزون */
export async function applyShipmentStatusTx(tx: Prisma.TransactionClient, shipmentId: string, to: ShipmentStatus, userId: string) {
  const sh = await tx.shipment.findUnique({ where: { id: shipmentId }, include: { items: { include: { purchaseOrderItem: { include: { variant: { include: { product: true } } } } } } } });
  if (!sh) return;
  const orderItemIds = sh.items.map((si) => si.purchaseOrderItem.orderItemId).filter((x): x is string => !!x);
  const note = `الشحنة ${sh.number}`;
  if (to === "IN_TRANSIT" || to === "CUSTOMS") await syncItemsTx(tx, { itemIds: orderItemIds, to: "INTL_SHIPPING", note, userId });
  if (to === "ARRIVED_LIBYA" || to === "RECEIVED") {
    await syncItemsTx(tx, { itemIds: orderItemIds, to: "ARRIVED_LIBYA", note, userId });
  }
  if (to === "ARRIVED_LIBYA") {
    await tx.notification.create({ data: { event: "shipment.arrived", title: `وصلت الشحنة ${sh.number} إلى ليبيا`, body: `${sh.items.length} بند`, link: `/admin/shipments/${sh.id}` } });
  }
  if (to === "RECEIVED") {
    for (const si of sh.items) {
      const poi = si.purchaseOrderItem;
      await tx.purchaseOrderItem.update({ where: { id: poi.id }, data: { receivedQty: { increment: si.quantity } } });
      if (!poi.orderItemId) {
        // شراء للمخزون: تُضاف الكمية للمخزون المحلي
        await tx.productVariant.update({ where: { id: poi.variantId }, data: { stockQty: { increment: si.quantity } } });
        await tx.inventoryMovement.create({ data: { variantId: poi.variantId, type: "IN", quantity: si.quantity, reference: sh.number, note: "استلام شحنة", userId } });
      }
    }
  }
}

export function trackingLink(template: string | null | undefined, tracking: string) {
  if (!template || !tracking || !template.includes("{tracking}")) return null;
  return template.replace("{tracking}", encodeURIComponent(tracking));
}
