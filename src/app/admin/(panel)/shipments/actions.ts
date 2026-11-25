"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, type ShipmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { nextNumber } from "@/lib/numbering";
import { allocateShipmentTx, applyShipmentStatusTx, recalcPurchaseOrderTx, refreshPoShippingStatusTx, shipmentNext, SHIPMENT_STATUS_LABELS } from "@/lib/purchasing";
import { latestRates } from "@/lib/settings";
import { bool, flashRedirect, num, str } from "@/lib/action-utils";

const D = (n: number, p = 2) => new Prisma.Decimal(n.toFixed(p));
const back = (id: string) => `/admin/shipments/${id}`;
const dateOrNull = (s: string) => (s ? new Date(s) : null);

export async function createShipment() {
  const u = await requireUser("shipping.manage");
  const sh = await db.$transaction(async (tx) => tx.shipment.create({ data: { number: await nextNumber(tx, "SHP") } }));
  await audit(u.id, "create", "Shipment", sh.id, undefined, sh);
  redirect(back(sh.id));
}

export async function saveShipment(fd: FormData) {
  const u = await requireUser("shipping.manage");
  const id = str(fd, "id");
  const before = await db.shipment.findUnique({ where: { id } });
  if (!before) flashRedirect("/admin/shipments", { err: "غير موجودة" });
  const costCurrency = (str(fd, "costCurrency") || "USD").toUpperCase();
  let rate = num(fd, "exchangeRate");
  if (!(rate > 0) && costCurrency !== "LYD") rate = (await latestRates())[costCurrency] ?? 0;
  const allocation = str(fd, "allocation") === "BY_QUANTITY" ? "BY_QUANTITY" : "BY_VALUE";
  const warning = await db.$transaction(async (tx) => {
    await tx.shipment.update({
      where: { id },
      data: {
        carrierId: str(fd, "carrierId") || null,
        trackingNumber: str(fd, "trackingNumber"),
        originCountry: str(fd, "originCountry"),
        shippedAt: dateOrNull(str(fd, "shippedAt")),
        expectedArrival: dateOrNull(str(fd, "expectedArrival")),
        weightKg: str(fd, "weightKg") ? D(num(fd, "weightKg"), 3) : null,
        volumeCbm: str(fd, "volumeCbm") ? D(num(fd, "volumeCbm"), 4) : null,
        cost: D(Math.max(0, num(fd, "cost"))),
        costCurrency,
        exchangeRate: costCurrency === "LYD" ? null : rate > 0 ? D(rate, 6) : null,
        customsFeesLyd: D(Math.max(0, num(fd, "customsFeesLyd"))),
        allocation,
        notes: str(fd, "notes"),
      },
    });
    return allocateShipmentTx(tx, id);
  });
  await audit(u.id, "update", "Shipment", id, before);
  revalidatePath(back(id));
  flashRedirect(back(id), warning ? { err: `تم الحفظ. ${warning}` } : { ok: "تم الحفظ وتوزيع التكاليف على البنود" });
}

export async function addShipmentItems(fd: FormData) {
  const u = await requireUser("shipping.manage");
  const id = str(fd, "id");
  const sh = await db.shipment.findUnique({ where: { id } });
  if (!sh || !["PENDING", "IN_TRANSIT"].includes(sh.status)) flashRedirect(back(id), { err: "إضافة البنود متاحة قبل وصول الشحنة فقط" });
  const lineIds = fd.getAll("poItemId").map(String);
  if (lineIds.length === 0) flashRedirect(back(id), { err: "اختر بنوداً" });
  const warning = await db.$transaction(async (tx) => {
    const pois = await tx.purchaseOrderItem.findMany({
      where: { id: { in: lineIds }, purchaseOrder: { status: { in: ["ORDERED", "PARTIALLY_SHIPPED"] } } },
      include: { shipmentItems: { where: { shipment: { status: { not: "CANCELLED" } } } } },
    });
    for (const poi of pois) {
      const remaining = poi.quantity - poi.shipmentItems.reduce((a, b) => a + b.quantity, 0);
      const qty = Math.min(remaining, Math.max(1, Math.round(num(fd, `qty_${poi.id}`, remaining))));
      if (remaining <= 0) continue;
      await tx.shipmentItem.create({ data: { shipmentId: id, purchaseOrderItemId: poi.id, quantity: qty } });
    }
    for (const poId of new Set(pois.map((p) => p.purchaseOrderId))) await refreshPoShippingStatusTx(tx, poId);
    // إن كانت الشحنة في الطريق، البنود المضافة تنتقل لحالتها
    if (sh.status === "IN_TRANSIT") await applyShipmentStatusTx(tx, id, "IN_TRANSIT", u.id);
    return allocateShipmentTx(tx, id);
  });
  await audit(u.id, "add_items", "Shipment", id, undefined, { lineIds });
  flashRedirect(back(id), warning ? { err: `أُضيفت البنود. ${warning}` } : { ok: "أُضيفت البنود" });
}

export async function removeShipmentItem(fd: FormData) {
  const u = await requireUser("shipping.manage");
  const si = await db.shipmentItem.findUnique({ where: { id: str(fd, "itemId") }, include: { shipment: true, purchaseOrderItem: true } });
  if (!si) flashRedirect("/admin/shipments", { err: "غير موجود" });
  if (si.shipment.status !== "PENDING") flashRedirect(back(si.shipmentId), { err: "الحذف متاح قبل شحن الشحنة فقط" });
  await db.$transaction(async (tx) => {
    await tx.shipmentItem.delete({ where: { id: si.id } });
    await refreshPoShippingStatusTx(tx, si.purchaseOrderItem.purchaseOrderId);
    await allocateShipmentTx(tx, si.shipmentId);
    // البند المحذوف يفقد نصيبه من تكلفة هذه الشحنة
    await recalcPurchaseOrderTx(tx, si.purchaseOrderItem.purchaseOrderId);
  });
  await audit(u.id, "remove_item", "Shipment", si.shipmentId, si);
  flashRedirect(back(si.shipmentId), { ok: "حُذف البند من الشحنة" });
}

export async function setShipmentStatus(fd: FormData) {
  const u = await requireUser("shipping.manage");
  const id = str(fd, "id");
  const to = str(fd, "to") as ShipmentStatus;
  const sh = await db.shipment.findUnique({ where: { id }, include: { _count: { select: { items: true } } } });
  if (!sh) flashRedirect("/admin/shipments", { err: "غير موجودة" });
  if (!shipmentNext(sh.status).includes(to)) flashRedirect(back(id), { err: "انتقال غير مسموح" });
  if (to !== "CANCELLED" && sh._count.items === 0) flashRedirect(back(id), { err: "أضف بنوداً للشحنة أولاً" });
  if (to === "IN_TRANSIT" && !sh.trackingNumber) flashRedirect(back(id), { err: "سجّل رقم التتبع قبل الشحن" });
  const when = str(fd, "when") ? new Date(str(fd, "when")) : new Date();
  await db.$transaction(async (tx) => {
    await tx.shipment.update({
      where: { id },
      data: {
        status: to,
        ...(to === "IN_TRANSIT" && !sh.shippedAt ? { shippedAt: when } : {}),
        ...(to === "ARRIVED_LIBYA" ? { arrivedAt: when } : {}),
      },
    });
    await tx.shipmentEvent.create({ data: { shipmentId: id, occurredAt: when, description: SHIPMENT_STATUS_LABELS[to], location: str(fd, "location") } });
    if (to === "CANCELLED") {
      const items = await tx.shipmentItem.findMany({ where: { shipmentId: id }, include: { purchaseOrderItem: true } });
      for (const poId of new Set(items.map((i) => i.purchaseOrderItem.purchaseOrderId))) await refreshPoShippingStatusTx(tx, poId);
    } else await applyShipmentStatusTx(tx, id, to, u.id);
  });
  await audit(u.id, "status_change", "Shipment", id, { status: sh.status }, { status: to });
  revalidatePath(back(id));
  flashRedirect(back(id), { ok: `حالة الشحنة: ${SHIPMENT_STATUS_LABELS[to]}` });
}

export async function addEvent(fd: FormData) {
  const u = await requireUser("shipping.manage");
  const id = str(fd, "id");
  const description = str(fd, "description");
  if (!description) flashRedirect(back(id), { err: "اكتب وصف الحدث" });
  await db.shipmentEvent.create({ data: { shipmentId: id, occurredAt: str(fd, "when") ? new Date(str(fd, "when")) : new Date(), location: str(fd, "location"), description } });
  await audit(u.id, "add_event", "Shipment", id, undefined, { description });
  flashRedirect(back(id), { ok: "أُضيف الحدث" });
}

export async function saveCarrier(fd: FormData) {
  const u = await requireUser("shipping.manage");
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!name) flashRedirect("/admin/shipments/carriers", { err: "اسم الشركة مطلوب" });
  const tpl = str(fd, "trackingUrl");
  if (tpl && !tpl.includes("{tracking}")) flashRedirect("/admin/shipments/carriers", { err: "رابط التتبع يجب أن يحتوي {tracking} مكان رقم الشحنة" });
  const data = { name, trackingUrl: tpl, active: bool(fd, "active") };
  if (id) await db.carrier.update({ where: { id }, data });
  else await db.carrier.create({ data });
  await audit(u.id, id ? "update" : "create", "Carrier", id || name, undefined, data);
  flashRedirect("/admin/shipments/carriers", { ok: "تم الحفظ" });
}
