"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, type DeliveryStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { nextNumber } from "@/lib/numbering";
import { csvObjects } from "@/lib/csv";
import { createDeliveriesTx, createHandoverTx, DeliveryError, importDeliveryCsv, updateDelivery, type ImportResult } from "@/lib/delivery";
import { bool, flashRedirect, num, str } from "@/lib/action-utils";

const D = (n: number) => new Prisma.Decimal(n.toFixed(2));

export async function savePartner(fd: FormData) {
  const u = await requireUser("delivery.manage");
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!name) flashRedirect("/admin/delivery/partners", { err: "اسم الشركة مطلوب" });
  const data = {
    name,
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    address: str(fd, "address"),
    integrationMode: str(fd, "integrationMode") === "MANUAL" ? ("MANUAL" as const) : ("FILE" as const),
    defaultFee: D(Math.max(0, num(fd, "defaultFee"))),
    notes: str(fd, "notes"),
    active: id ? bool(fd, "active") : true,
  };
  const p = id ? await db.deliveryPartner.update({ where: { id }, data }) : await db.deliveryPartner.create({ data });
  await audit(u.id, id ? "update" : "create", "DeliveryPartner", p.id, undefined, data);
  revalidatePath("/admin/delivery", "layout");
  flashRedirect("/admin/delivery/partners", { ok: "تم الحفظ" });
}

export async function savePoint(fd: FormData) {
  const u = await requireUser("delivery.manage");
  const id = str(fd, "id");
  const data = { name: str(fd, "name"), city: str(fd, "city"), address: str(fd, "address"), phone: str(fd, "phone"), active: id ? bool(fd, "active") : true };
  if (!data.name || !data.city) flashRedirect("/admin/delivery/partners", { err: "اسم النقطة والمدينة مطلوبان" });
  const p = id ? await db.deliveryPoint.update({ where: { id }, data }) : await db.deliveryPoint.create({ data: { ...data, partnerId: str(fd, "partnerId") } });
  await audit(u.id, id ? "update" : "create", "DeliveryPoint", p.id, undefined, data);
  flashRedirect("/admin/delivery/partners", { ok: "تم حفظ النقطة" });
}

export async function prepareDeliveries(fd: FormData) {
  const u = await requireUser("delivery.manage");
  const orderIds = fd.getAll("orderId").map(String);
  const partnerId = str(fd, "partnerId");
  if (orderIds.length === 0) flashRedirect("/admin/delivery", { err: "اختر طلبات" });
  if (!partnerId) flashRedirect("/admin/delivery", { err: "أضف شركة التوزيع أولاً من «الشركة والنقاط»" });
  const ids = await db.$transaction((tx) => createDeliveriesTx(tx, { orderIds, partnerId, userId: u.id }));
  await audit(u.id, "create", "Delivery", ids.join(","), undefined, { orderIds, partnerId });
  if (ids.length === 0) flashRedirect("/admin/delivery", { err: "لا توجد بنود جاهزة في الطلبات المحددة" });
  redirect(`/admin/delivery/list?status=READY&ok=${encodeURIComponent(`جُهّز ${ids.length} طرد. اطبع الملصقات ثم أنشئ دفعة تسليم`)}`);
}

export async function createHandover(fd: FormData) {
  const u = await requireUser("delivery.manage");
  const back = "/admin/delivery/list?status=READY";
  try {
    const h = await db.$transaction((tx) =>
      createHandoverTx(tx, { partnerId: str(fd, "partnerId"), deliveryIds: fd.getAll("deliveryId").map(String), receivedBy: str(fd, "receivedBy"), notes: str(fd, "notes"), userId: u.id }),
    );
    await audit(u.id, "create", "Handover", h.id, undefined, h);
    redirect(`/admin/delivery/handovers/${h.id}?ok=${encodeURIComponent("أُنشئت دفعة التسليم. اطبع الكشف ليوقّعه مندوب النورس")}`);
  } catch (e) {
    if (e instanceof DeliveryError) flashRedirect(back, { err: e.message });
    throw e;
  }
}

export async function setDeliveryStatus(fd: FormData) {
  const u = await requireUser("delivery.manage");
  const id = str(fd, "id");
  const back = str(fd, "back") || `/admin/delivery/${id}`;
  const to = str(fd, "to") as DeliveryStatus;
  const collectedRaw = str(fd, "collected");
  try {
    const res = await updateDelivery(
      id,
      { status: to || null, collected: collectedRaw === "" ? null : num(fd, "collected"), reason: str(fd, "reason"), restock: bool(fd, "restock"), note: str(fd, "note") },
      { userId: u.id, source: "admin" },
    );
    await audit(u.id, "status_change", "Delivery", id, undefined, { to, collected: collectedRaw });
    revalidatePath("/admin", "layout");
    flashRedirect(back, { ok: res.changed ? "تم تحديث الحالة" : "تم الحفظ" });
  } catch (e) {
    if (e instanceof DeliveryError) flashRedirect(back, { err: e.message });
    throw e;
  }
}

export async function saveDelivery(fd: FormData) {
  const u = await requireUser("delivery.manage");
  const id = str(fd, "id");
  const d = await db.delivery.findUnique({ where: { id } });
  if (!d) flashRedirect("/admin/delivery/list", { err: "غير موجودة" });
  const data: Prisma.DeliveryUpdateInput = {
    waybillNo: str(fd, "waybillNo"),
    courierName: str(fd, "courierName"),
    point: str(fd, "pointId") ? { connect: { id: str(fd, "pointId") } } : { disconnect: true },
  };
  // المبالغ لا تتغير بعد التسوية
  if (!d.settlementId) {
    data.fee = D(Math.max(0, num(fd, "fee")));
    if (!["DELIVERED", "RETURNED", "CANCELLED"].includes(d.status)) data.codAmount = D(Math.max(0, num(fd, "codAmount")));
  }
  await db.delivery.update({ where: { id }, data });
  await audit(u.id, "update", "Delivery", id, { fee: d.fee, codAmount: d.codAmount, waybillNo: d.waybillNo }, { fee: str(fd, "fee"), codAmount: str(fd, "codAmount"), waybillNo: str(fd, "waybillNo") });
  flashRedirect(`/admin/delivery/${id}`, { ok: "تم الحفظ" });
}

export async function importStatuses(_prev: ImportResult[] | { error: string } | null, fd: FormData): Promise<ImportResult[] | { error: string }> {
  const u = await requireUser("delivery.manage");
  const file = fd.get("file") as File | null;
  if (!file || file.size === 0) return { error: "اختر ملف CSV" };
  if (file.size > 2_000_000) return { error: "الملف أكبر من 2 ميغابايت" };
  const rows = csvObjects(await file.text());
  if (rows.length === 0) return { error: "الملف فارغ" };
  const res = await importDeliveryCsv(rows, { userId: u.id, source: "admin" });
  await audit(u.id, "import", "Delivery", file.name, undefined, { rows: res.length, ok: res.filter((r) => r.ok).length });
  revalidatePath("/admin", "layout");
  return res;
}

export async function createSettlement(fd: FormData) {
  const u = await requireUser("payments.manage");
  const partnerId = str(fd, "partnerId");
  const ids = fd.getAll("deliveryId").map(String);
  const back = `/admin/delivery/settlements/new?partner=${partnerId}`;
  if (ids.length === 0) flashRedirect(back, { err: "اختر التوصيلات المشمولة بالتسوية" });
  const st = await db.$transaction(async (tx) => {
    const ds = await tx.delivery.findMany({ where: { id: { in: ids }, partnerId, settlementId: null, status: { in: ["DELIVERED", "RETURNED"] } }, include: { order: true } });
    if (ds.length !== ids.length) throw new DeliveryError("بعض التوصيلات لم تعد متاحة للتسوية، أعد تحميل الصفحة");
    const collected = ds.reduce((s, d) => s + Number(d.collected ?? 0), 0);
    const fees = fd.get("feesDeducted") === "" ? ds.reduce((s, d) => s + Number(d.fee), 0) : Math.max(0, num(fd, "feesDeducted"));
    const net = num(fd, "netReceived", NaN);
    if (Number.isNaN(net) || net < 0) throw new DeliveryError("أدخل المبلغ الصافي المستلم فعلاً من النورس");
    const dates = ds.map((d) => (d.deliveredAt ?? d.updatedAt).getTime());
    const cod = await tx.paymentMethod.findUnique({ where: { code: "COD" } });
    const number = await nextNumber(tx, "STL");
    const s = await tx.settlement.create({
      data: {
        number,
        partnerId,
        periodFrom: new Date(Math.min(...dates)),
        periodTo: new Date(Math.max(...dates)),
        collected: D(collected),
        feesDeducted: D(fees),
        netReceived: D(net),
        receivedAt: str(fd, "receivedAt") ? new Date(str(fd, "receivedAt")) : new Date(),
        reference: str(fd, "reference"),
        notes: str(fd, "notes"),
      },
    });
    for (const d of ds) {
      await tx.delivery.update({ where: { id: d.id }, data: { settlementId: s.id } });
      const amt = Number(d.collected ?? 0);
      if (amt > 0) {
        // المبلغ المحصّل يُسجَّل كدفعة على الطلب عند استلامه فعلاً من النورس
        await tx.payment.create({
          data: { orderId: d.orderId, kind: "PAYMENT", amount: D(amt), methodId: cod?.id, reference: `${number} / ${d.number}`, note: "تحصيل عند الاستلام عبر النورس", settlementId: s.id, receivedAt: s.receivedAt ?? new Date(), createdById: u.id },
        });
      }
    }
    return s;
  }).catch((e) => {
    if (e instanceof DeliveryError) flashRedirect(back, { err: e.message });
    throw e;
  });
  await audit(u.id, "create", "Settlement", st.id, undefined, st);
  redirect(`/admin/delivery/settlements/${st.id}?ok=${encodeURIComponent("سُجّلت التسوية وأُضيفت المبالغ كدفعات على الطلبات")}`);
}
