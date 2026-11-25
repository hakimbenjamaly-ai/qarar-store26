"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { nextNumber } from "@/lib/numbering";
import { syncItemsTx } from "@/lib/orders";
import { recalcPurchaseOrderTx, refreshPoShippingStatusTx } from "@/lib/purchasing";
import { latestRates } from "@/lib/settings";
import { bool, flashRedirect, num, str } from "@/lib/action-utils";

const D = (n: number, p = 2) => new Prisma.Decimal(n.toFixed(p));
const back = (id: string) => `/admin/purchase-orders/${id}`;

export async function createFromQueue(fd: FormData) {
  const u = await requireUser("purchasing.manage");
  const itemIds = fd.getAll("itemId").map(String);
  const supplierId = str(fd, "supplierId");
  if (itemIds.length === 0 || !supplierId) flashRedirect("/admin/purchasing", { err: "اختر البنود والمورد" });
  const supplier = await db.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) flashRedirect("/admin/purchasing", { err: "المورد غير موجود" });
  const currency = (str(fd, "currency") || supplier.currency).toUpperCase();
  const rates = await latestRates();

  const po = await db.$transaction(async (tx) => {
    const items = await tx.orderItem.findMany({
      where: { id: { in: itemIds }, status: "PURCHASING", sourcing: "IMPORT_ON_ORDER", purchaseItems: { none: { purchaseOrder: { status: { not: "CANCELLED" } } } } },
      include: { variant: { include: { cost: true, supplierProducts: { where: { supplierId } } } } },
    });
    if (items.length === 0) throw new Error("البنود المحددة لم تعد بانتظار الشراء");
    const number = await nextNumber(tx, "PO");
    const created = await tx.purchaseOrder.create({
      data: {
        number,
        supplierId,
        currency,
        exchangeRate: rates[currency] !== undefined ? D(rates[currency], 6) : null,
        items: {
          create: items.map((it) => {
            const sp = it.variant.supplierProducts[0];
            const price = sp && sp.currency === currency ? Number(sp.price) : it.variant.cost && it.variant.cost.purchaseCurrency === currency ? Number(it.variant.cost.purchasePrice) : 0;
            return { variantId: it.variantId, orderItemId: it.id, quantity: it.quantity, unitPrice: D(price) };
          }),
        },
      },
    });
    await recalcPurchaseOrderTx(tx, created.id);
    await audit(u.id, "create", "PurchaseOrder", created.id, undefined, { number, supplierId, items: items.map((i) => i.id) }, tx);
    return created;
  }).catch((e: Error) => flashRedirect("/admin/purchasing", { err: e.message }));
  redirect(back(po.id));
}

export async function createStockPO(fd: FormData) {
  const u = await requireUser("purchasing.manage");
  const supplierId = str(fd, "supplierId");
  const supplier = await db.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) flashRedirect("/admin/purchase-orders/new", { err: "اختر المورد" });
  const rates = await latestRates();
  const po = await db.$transaction(async (tx) => {
    const number = await nextNumber(tx, "PO");
    return tx.purchaseOrder.create({ data: { number, supplierId, currency: supplier.currency, exchangeRate: rates[supplier.currency] !== undefined ? D(rates[supplier.currency], 6) : null, notes: "شراء للمخزون" } });
  });
  await audit(u.id, "create", "PurchaseOrder", po.id, undefined, po);
  redirect(back(po.id));
}

export async function savePO(fd: FormData) {
  const u = await requireUser("purchasing.manage");
  const id = str(fd, "id");
  const po = await db.purchaseOrder.findUnique({ where: { id }, include: { items: { include: { orderItem: true } } } });
  if (!po) flashRedirect("/admin/purchase-orders", { err: "غير موجود" });
  if (po.status === "CANCELLED") flashRedirect(back(id), { err: "أمر الشراء ملغى" });
  const rate = num(fd, "exchangeRate");
  await db.$transaction(async (tx) => {
    await tx.purchaseOrder.update({
      where: { id },
      data: {
        supplierOrderNo: str(fd, "supplierOrderNo"),
        invoiceNo: str(fd, "invoiceNo"),
        currency: po.status === "DRAFT" ? (str(fd, "currency") || po.currency).toUpperCase() : po.currency,
        exchangeRate: rate > 0 ? D(rate, 6) : null,
        orderedAt: str(fd, "orderedAt") ? new Date(str(fd, "orderedAt")) : po.orderedAt,
        notes: str(fd, "notes"),
      },
    });
    for (const it of po.items) {
      const price = num(fd, `price_${it.id}`, Number(it.unitPrice));
      // الكمية تعدّل في المسودة فقط ولبنود المخزون فقط (بنود العملاء بكمية الطلب)
      const qty = po.status === "DRAFT" && !it.orderItemId ? Math.max(1, Math.round(num(fd, `qty_${it.id}`, it.quantity))) : it.quantity;
      await tx.purchaseOrderItem.update({ where: { id: it.id }, data: { unitPrice: D(Math.max(0, price)), quantity: qty } });
      if (bool(fd, "updateProductCost")) {
        const currency = (str(fd, "currency") || po.currency).toUpperCase();
        await tx.productCost.upsert({
          where: { variantId: it.variantId },
          create: { variantId: it.variantId, supplierId: po.supplierId, purchasePrice: D(Math.max(0, price)), purchaseCurrency: currency },
          update: { supplierId: po.supplierId, purchasePrice: D(Math.max(0, price)), purchaseCurrency: currency },
        });
      }
    }
    await recalcPurchaseOrderTx(tx, id);
  });
  await audit(u.id, "update", "PurchaseOrder", id, po);
  revalidatePath(back(id));
  flashRedirect(back(id), { ok: "تم الحفظ" });
}

export async function addStockLine(fd: FormData) {
  const u = await requireUser("purchasing.manage");
  const id = str(fd, "id");
  const po = await db.purchaseOrder.findUnique({ where: { id } });
  if (!po || po.status !== "DRAFT") flashRedirect(back(id), { err: "الإضافة متاحة في المسودة فقط" });
  const variant = await db.productVariant.findUnique({ where: { sku: str(fd, "sku").toUpperCase() } });
  if (!variant) flashRedirect(back(id), { err: "لا يوجد خيار منتج بهذا الرمز" });
  const qty = Math.round(num(fd, "qty"));
  if (qty < 1) flashRedirect(back(id), { err: "الكمية غير صحيحة" });
  await db.$transaction(async (tx) => {
    await tx.purchaseOrderItem.create({ data: { purchaseOrderId: id, variantId: variant.id, quantity: qty, unitPrice: D(Math.max(0, num(fd, "price"))) } });
    await recalcPurchaseOrderTx(tx, id);
  });
  await audit(u.id, "add_line", "PurchaseOrder", id, undefined, { sku: variant.sku, qty });
  flashRedirect(back(id), { ok: "تمت إضافة البند" });
}

export async function removeLine(fd: FormData) {
  const u = await requireUser("purchasing.manage");
  const lineId = str(fd, "lineId");
  const line = await db.purchaseOrderItem.findUnique({ where: { id: lineId }, include: { purchaseOrder: true } });
  if (!line) flashRedirect("/admin/purchase-orders", { err: "غير موجود" });
  if (line.purchaseOrder.status !== "DRAFT") flashRedirect(back(line.purchaseOrderId), { err: "الحذف متاح في المسودة فقط" });
  await db.$transaction(async (tx) => {
    await tx.purchaseOrderItem.delete({ where: { id: lineId } });
    await recalcPurchaseOrderTx(tx, line.purchaseOrderId);
  });
  await audit(u.id, "remove_line", "PurchaseOrder", line.purchaseOrderId, line);
  flashRedirect(back(line.purchaseOrderId), { ok: line.orderItemId ? "حُذف البند وعاد إلى قائمة بانتظار الشراء" : "حُذف البند" });
}

export async function setPOStatus(fd: FormData) {
  const u = await requireUser("purchasing.manage");
  const id = str(fd, "id");
  const to = str(fd, "to");
  const po = await db.purchaseOrder.findUnique({ where: { id }, include: { items: { include: { shipmentItems: { where: { shipment: { status: { not: "CANCELLED" } } } } } } } });
  if (!po) flashRedirect("/admin/purchase-orders", { err: "غير موجود" });
  const orderItemIds = po.items.map((i) => i.orderItemId).filter((x): x is string => !!x);
  if (to === "ORDERED") {
    if (po.status !== "DRAFT") flashRedirect(back(id), { err: "أمر الشراء ليس مسودة" });
    if (po.items.length === 0) flashRedirect(back(id), { err: "أضف بنوداً أولاً" });
    if (po.items.some((i) => Number(i.unitPrice) <= 0)) flashRedirect(back(id), { err: "أدخل سعر الشراء لكل البنود قبل التأكيد" });
    await db.$transaction(async (tx) => {
      await tx.purchaseOrder.update({ where: { id }, data: { status: "ORDERED", orderedAt: po.orderedAt ?? new Date() } });
      await syncItemsTx(tx, { itemIds: orderItemIds, to: "PURCHASED", note: `أمر الشراء ${po.number}`, userId: u.id });
      await refreshPoShippingStatusTx(tx, id);
    });
  } else if (to === "CANCELLED") {
    if (po.items.some((i) => i.shipmentItems.length > 0)) flashRedirect(back(id), { err: "لا يمكن إلغاء أمر شراء أُضيفت بنوده إلى شحنة. احذفها من الشحنة أولاً" });
    await db.$transaction(async (tx) => {
      await tx.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
      // البنود المشتراة تعود إلى «قيد الشراء» لتظهر في القائمة مجدداً
      await syncItemsTx(tx, { itemIds: orderItemIds, to: "PURCHASING", note: `إلغاء أمر الشراء ${po.number}`, userId: u.id, revertFrom: ["PURCHASED"] });
      await tx.orderItem.updateMany({ where: { id: { in: orderItemIds } }, data: { actualUnitCostLyd: null } });
    });
  } else flashRedirect(back(id), { err: "حالة غير صحيحة" });
  await audit(u.id, "status_change", "PurchaseOrder", id, { status: po.status }, { status: to });
  revalidatePath(back(id));
  flashRedirect(back(id), { ok: to === "ORDERED" ? "تم تأكيد الطلب من المورد وتحديث حالات طلبات العملاء" : "تم إلغاء أمر الشراء" });
}
