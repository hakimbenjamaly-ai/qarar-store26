import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, lyd } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/order-status";
import { SHIPMENT_STATUS_LABELS, shipmentNext, trackingLink } from "@/lib/purchasing";
import { Field, Flash, PageHeader } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { Attachments } from "@/components/admin/attachments";
import { addEvent, addShipmentItems, removeShipmentItem, saveShipment, setShipmentStatus } from "../actions";

const day = (d: Date | null) => d?.toISOString().slice(0, 10) ?? "";

export default async function ShipmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser("shipping.manage");
  const id = (await params).id;
  const [sh, carriers] = await Promise.all([
    db.shipment.findUnique({
      where: { id },
      include: {
        carrier: true,
        events: { orderBy: { occurredAt: "desc" } },
        items: {
          include: {
            purchaseOrderItem: {
              include: {
                purchaseOrder: { select: { id: true, number: true, currency: true } },
                variant: { select: { sku: true, name: true, product: { select: { name: true } } } },
                orderItem: { select: { status: true, order: { select: { id: true, number: true } } } },
              },
            },
          },
        },
      },
    }),
    db.carrier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!sh) notFound();
  const sp = await searchParams;
  const editable = !["RECEIVED", "CANCELLED"].includes(sh.status);
  const canAdd = ["PENDING", "IN_TRANSIT"].includes(sh.status);
  const available = canAdd
    ? (
        await db.purchaseOrderItem.findMany({
          where: { purchaseOrder: { status: { in: ["ORDERED", "PARTIALLY_SHIPPED"] } } },
          include: {
            purchaseOrder: { select: { number: true, supplier: { select: { name: true } } } },
            variant: { select: { sku: true, name: true, product: { select: { name: true } } } },
            orderItem: { select: { order: { select: { number: true } } } },
            shipmentItems: { where: { shipment: { status: { not: "CANCELLED" } } } },
          },
          orderBy: { purchaseOrder: { createdAt: "asc" } },
        })
      )
        .map((p) => ({ ...p, remaining: p.quantity - p.shipmentItems.reduce((a, b) => a + b.quantity, 0) }))
        .filter((p) => p.remaining > 0)
    : [];
  const link = trackingLink(sh.carrier?.trackingUrl, sh.trackingNumber);
  const next = shipmentNext(sh.status);
  const backUrl = `/admin/shipments/${sh.id}`;
  const allocatedTotal = sh.items.reduce((s, i) => s + (i.allocatedCostLyd ? Number(i.allocatedCostLyd) : 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={`شحنة ${sh.number}`} back="/admin/shipments" actions={link ? <a href={link} target="_blank" className="btn-outline">تتبع لدى {sh.carrier?.name} ↗</a> : undefined} />
      <Flash {...sp} />
      <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
        <span className="badge bg-sky-100 text-sky-800">{SHIPMENT_STATUS_LABELS[sh.status]}</span>
        {next.length > 0 && (
          <form action={setShipmentStatus} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={sh.id} />
            <select name="to" required defaultValue="" className="input w-auto py-1"><option value="" disabled>تغيير الحالة إلى...</option>{next.map((s) => <option key={s} value={s}>{SHIPMENT_STATUS_LABELS[s]}</option>)}</select>
            <input name="when" type="datetime-local" className="input w-auto py-1" aria-label="التاريخ" />
            <input name="location" placeholder="المكان (اختياري)" className="input w-40 py-1" />
            <Submit className="btn-primary py-1">تحديث</Submit>
          </form>
        )}
        {next.includes("RECEIVED") && <span className="text-xs text-gray-500">«تم الاستلام» نهائي: يضيف بنود المخزون إلى الكميات المتاحة.</span>}
      </div>

      <form action={saveShipment} className="card p-4 text-sm">
        <input type="hidden" name="id" value={sh.id} />
        <fieldset disabled={!editable} className="grid gap-3 md:grid-cols-4">
          <Field label="شركة الشحن">
            <select name="carrierId" defaultValue={sh.carrierId ?? ""} className="input"><option value="">—</option>{carriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </Field>
          <Field label="رقم التتبع"><input name="trackingNumber" defaultValue={sh.trackingNumber} dir="ltr" className="input" /></Field>
          <Field label="بلد الإرسال"><input name="originCountry" defaultValue={sh.originCountry} className="input" /></Field>
          <Field label="تاريخ الشحن"><input name="shippedAt" type="date" defaultValue={day(sh.shippedAt)} className="input" /></Field>
          <Field label="الوصول المتوقع"><input name="expectedArrival" type="date" defaultValue={day(sh.expectedArrival)} className="input" /></Field>
          <Field label="الوزن (كغ)"><input name="weightKg" defaultValue={sh.weightKg ? String(sh.weightKg) : ""} inputMode="decimal" className="input" /></Field>
          <Field label="الحجم (م³)"><input name="volumeCbm" defaultValue={sh.volumeCbm ? String(sh.volumeCbm) : ""} inputMode="decimal" className="input" /></Field>
          <Field label="تاريخ الوصول الفعلي"><input value={dateTime(sh.arrivedAt)} disabled className="input bg-gray-50" readOnly /></Field>
          <Field label="تكلفة الشحن">
            <div className="flex gap-1">
              <input name="cost" defaultValue={String(sh.cost)} inputMode="decimal" className="input" />
              <input name="costCurrency" defaultValue={sh.costCurrency} dir="ltr" className="input w-20" aria-label="العملة" />
            </div>
          </Field>
          <Field label="سعر الصرف" hint="يُملأ من آخر سعر مسجل إن تُرك فارغاً"><input name="exchangeRate" defaultValue={sh.exchangeRate ? String(sh.exchangeRate) : ""} inputMode="decimal" className="input" /></Field>
          <Field label="جمارك ورسوم تخليص (د.ل)"><input name="customsFeesLyd" defaultValue={String(sh.customsFeesLyd)} inputMode="decimal" className="input" /></Field>
          <Field label="توزيع التكلفة على البنود">
            <select name="allocation" defaultValue={sh.allocation === "BY_QUANTITY" ? "BY_QUANTITY" : "BY_VALUE"} className="input">
              <option value="BY_VALUE">حسب قيمة الشراء</option>
              <option value="BY_QUANTITY">حسب عدد القطع</option>
            </select>
          </Field>
          <Field label="ملاحظات" className="md:col-span-3"><input name="notes" defaultValue={sh.notes} className="input" /></Field>
          {editable && <div className="self-end"><Submit>حفظ وتوزيع التكاليف</Submit></div>}
        </fieldset>
      </form>

      <section className="card overflow-x-auto">
        <h2 className="p-4 pb-2 font-bold">محتوى الشحنة</h2>
        <table className="table">
          <thead><tr><th>المنتج</th><th>أمر الشراء</th><th>لصالح</th><th>الكمية</th><th>نصيبه من التكلفة</th><th></th></tr></thead>
          <tbody>
            {sh.items.map((si) => {
              const p = si.purchaseOrderItem;
              return (
                <tr key={si.id}>
                  <td>{p.variant.product.name}<div className="text-xs text-gray-500" dir="ltr">{p.variant.sku} {p.variant.name}</div></td>
                  <td><Link href={`/admin/purchase-orders/${p.purchaseOrder.id}`} className="text-brand-700" dir="ltr">{p.purchaseOrder.number}</Link></td>
                  <td>{p.orderItem ? <><Link href={`/admin/orders/${p.orderItem.order.id}`} className="text-brand-700" dir="ltr">{p.orderItem.order.number}</Link> <span className="text-xs text-gray-500">{STATUS_LABELS[p.orderItem.status]}</span></> : "المخزون"}</td>
                  <td>{si.quantity}</td>
                  <td>{si.allocatedCostLyd ? lyd(si.allocatedCostLyd) : "—"}</td>
                  <td>{sh.status === "PENDING" && <form action={removeShipmentItem}><input type="hidden" name="itemId" value={si.id} /><Submit className="text-xs text-red-600" confirm="تأكيد؟">إزالة</Submit></form>}</td>
                </tr>
              );
            })}
            {sh.items.length === 0 && <tr><td colSpan={6} className="text-gray-500">الشحنة فارغة.</td></tr>}
          </tbody>
        </table>
        {sh.items.length > 0 && <p className="p-4 text-sm">إجمالي الموزّع: {lyd(allocatedTotal)}</p>}
      </section>

      {canAdd && (
        <form action={addShipmentItems} className="card overflow-x-auto">
          <input type="hidden" name="id" value={sh.id} />
          <h2 className="p-4 pb-2 font-bold">إضافة بنود مشتراة لم تُشحن</h2>
          {available.length === 0 ? <p className="p-4 pt-0 text-sm text-gray-500">لا توجد بنود في أوامر شراء مؤكدة بانتظار الشحن.</p> : (
            <>
              <table className="table">
                <thead><tr><th></th><th>المنتج</th><th>أمر الشراء</th><th>المورد</th><th>لصالح</th><th>الكمية</th></tr></thead>
                <tbody>
                  {available.map((p) => (
                    <tr key={p.id}>
                      <td><input type="checkbox" name="poItemId" value={p.id} aria-label="تحديد" /></td>
                      <td>{p.variant.product.name} <span className="text-xs text-gray-500">{p.variant.name}</span></td>
                      <td dir="ltr" className="text-right">{p.purchaseOrder.number}</td>
                      <td>{p.purchaseOrder.supplier.name}</td>
                      <td dir="ltr" className="text-right">{p.orderItem?.order.number ?? "المخزون"}</td>
                      <td><input name={`qty_${p.id}`} defaultValue={p.remaining} className="input w-20" aria-label="الكمية" /> <span className="text-xs text-gray-500">من {p.remaining}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4"><Submit>إضافة المحدد إلى الشحنة</Submit></div>
            </>
          )}
        </form>
      )}

      <section className="card p-4 text-sm">
        <h2 className="mb-3 font-bold">سجل التتبع</h2>
        <ul className="mb-3 space-y-2">
          {sh.events.map((e) => <li key={e.id} className="flex flex-wrap gap-3 border-b pb-2"><span className="text-gray-500">{dateTime(e.occurredAt)}</span><b>{e.description}</b>{e.location && <span>{e.location}</span>}</li>)}
          {sh.events.length === 0 && <li className="text-gray-500">لا توجد أحداث.</li>}
        </ul>
        {editable && (
          <form action={addEvent} className="flex flex-wrap gap-2">
            <input type="hidden" name="id" value={sh.id} />
            <input name="when" type="datetime-local" className="input w-auto" aria-label="التاريخ" />
            <input name="location" placeholder="المكان" className="input w-40" />
            <input name="description" required placeholder="الحدث (مثل: غادرت ميناء إسطنبول)" className="input w-72" />
            <Submit className="btn-outline">إضافة</Submit>
          </form>
        )}
      </section>

      <Attachments entity="Shipment" entityId={sh.id} back={backUrl} canEdit={sh.status !== "CANCELLED"} />
    </div>
  );
}
