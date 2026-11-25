import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, lyd } from "@/lib/format";
import { STATUS_LABELS, statusTone } from "@/lib/order-status";
import { PO_STATUS_LABELS, SHIPMENT_STATUS_LABELS } from "@/lib/purchasing";
import { Field, Flash, PageHeader } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { Attachments } from "@/components/admin/attachments";
import { addStockLine, removeLine, savePO, setPOStatus } from "../actions";

export default async function POPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser("purchasing.manage");
  const id = (await params).id;
  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: {
        orderBy: { id: "asc" },
        include: {
          variant: { include: { product: { select: { id: true, name: true } }, supplierProducts: { where: { supplier: { purchaseOrders: { some: { id } } } } } } },
          orderItem: { include: { order: { select: { id: true, number: true } } } },
          shipmentItems: { include: { shipment: { select: { id: true, number: true, status: true } } } },
        },
      },
    },
  });
  if (!po) notFound();
  const sp = await searchParams;
  const draft = po.status === "DRAFT";
  const closed = po.status === "CANCELLED";
  const rate = po.exchangeRate ? Number(po.exchangeRate) : null;
  const backUrl = `/admin/purchase-orders/${po.id}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`أمر شراء ${po.number}`}
        back="/admin/purchase-orders"
        actions={
          <>
            {draft && (
              <form action={setPOStatus}><input type="hidden" name="id" value={po.id} /><input type="hidden" name="to" value="ORDERED" /><Submit>تأكيد: تم الشراء من المورد</Submit></form>
            )}
            {!closed && po.status !== "SHIPPED" && (
              <form action={setPOStatus}><input type="hidden" name="id" value={po.id} /><input type="hidden" name="to" value="CANCELLED" /><Submit className="btn-outline text-red-600" confirm="اضغط مجدداً لإلغاء أمر الشراء">إلغاء الأمر</Submit></form>
            )}
          </>
        }
      />
      <Flash {...sp} />
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="badge bg-sky-100 text-sky-800">{PO_STATUS_LABELS[po.status]}</span>
        <span>المورد: <Link href={`/admin/suppliers/${po.supplierId}`} className="text-brand-700">{po.supplier.name}</Link></span>
        {po.supplier.website && <a href={po.supplier.website} target="_blank" className="text-brand-700">موقع المورد ↗</a>}
        <span className="text-gray-500">أُنشئ {dateTime(po.createdAt)}</span>
      </div>

      <form action={savePO} className="space-y-6">
        <input type="hidden" name="id" value={po.id} />
        <fieldset disabled={closed} className="card grid gap-3 p-4 text-sm md:grid-cols-3">
          <Field label="رقم الطلب لدى المورد"><input name="supplierOrderNo" defaultValue={po.supplierOrderNo} dir="ltr" className="input" /></Field>
          <Field label="رقم الفاتورة"><input name="invoiceNo" defaultValue={po.invoiceNo} dir="ltr" className="input" /></Field>
          <Field label="تاريخ الشراء"><input name="orderedAt" type="date" defaultValue={po.orderedAt?.toISOString().slice(0, 10)} className="input" /></Field>
          <Field label="العملة"><input name="currency" defaultValue={po.currency} disabled={!draft} dir="ltr" className="input" /></Field>
          <Field label={`سعر الصرف (دينار لكل 1 ${po.currency})`} hint="السعر الفعلي الذي دفعت به. مطلوب لحساب التكلفة الفعلية"><input name="exchangeRate" defaultValue={rate ?? ""} inputMode="decimal" className="input" /></Field>
          <Field label="ملاحظات"><input name="notes" defaultValue={po.notes} className="input" /></Field>
        </fieldset>

        <section className="card overflow-x-auto">
          <h2 className="p-4 pb-2 font-bold">البنود</h2>
          <table className="table">
            <thead><tr><th>المنتج</th><th>لصالح</th><th>الكمية</th><th>سعر الوحدة ({po.currency})</th><th>المجموع</th><th>التكلفة الواصلة للوحدة</th><th>الشحن</th><th></th></tr></thead>
            <tbody>
              {po.items.map((it) => {
                const shipped = it.shipmentItems.filter((s) => s.shipment.status !== "CANCELLED").reduce((a, b) => a + b.quantity, 0);
                const link = it.variant.supplierProducts[0];
                return (
                  <tr key={it.id}>
                    <td>
                      <Link href={`/admin/products/${it.variant.product.id}`} className="hover:text-brand-700">{it.variant.product.name}</Link>
                      <div className="text-xs text-gray-500" dir="ltr">{it.variant.sku} {it.variant.name}</div>
                      {link?.url && <a href={link.url} target="_blank" className="text-xs text-brand-700">الرابط لدى المورد ↗</a>}
                    </td>
                    <td>
                      {it.orderItem ? (
                        <>
                          <Link href={`/admin/orders/${it.orderItem.order.id}`} className="text-brand-700" dir="ltr">{it.orderItem.order.number}</Link>
                          <div><span className={`badge ${statusTone(it.orderItem.status)}`}>{STATUS_LABELS[it.orderItem.status]}</span></div>
                        </>
                      ) : <span className="text-gray-500">المخزون{it.receivedQty ? ` (استُلم ${it.receivedQty})` : ""}</span>}
                    </td>
                    <td>{draft && !it.orderItemId ? <input name={`qty_${it.id}`} defaultValue={it.quantity} className="input w-20" aria-label="الكمية" /> : it.quantity}</td>
                    <td><input name={`price_${it.id}`} defaultValue={String(it.unitPrice)} disabled={closed} inputMode="decimal" className="input w-28" aria-label="سعر الوحدة" /></td>
                    <td>{(Number(it.unitPrice) * it.quantity).toLocaleString("ar-LY")}</td>
                    <td>{it.landedUnitCostLyd ? lyd(it.landedUnitCostLyd) : <span className="text-xs text-gray-400">{rate ? "—" : "يتطلب سعر صرف"}</span>}</td>
                    <td className="text-xs">
                      {it.shipmentItems.map((s) => <div key={s.id}><Link href={`/admin/shipments/${s.shipment.id}`} className="text-brand-700" dir="ltr">{s.shipment.number}</Link> ({s.quantity}) {SHIPMENT_STATUS_LABELS[s.shipment.status]}</div>)}
                      {shipped < it.quantity && !draft && !closed && <span className="text-amber-700">لم يُشحن {it.quantity - shipped}</span>}
                    </td>
                    <td>{draft && <button formAction={removeLine} name="lineId" value={it.id} className="text-xs text-red-600">حذف</button>}</td>
                  </tr>
                );
              })}
              {po.items.length === 0 && <tr><td colSpan={8} className="text-gray-500">لا توجد بنود.</td></tr>}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-4 p-4 text-sm">
            <span className="font-bold">الإجمالي: {Number(po.total).toLocaleString("ar-LY")} {po.currency}{rate ? ` ≈ ${lyd(Number(po.total) * rate)}` : ""}</span>
            {!closed && <label className="flex items-center gap-1"><input type="checkbox" name="updateProductCost" /> تحديث سعر الشراء في بطاقات المنتجات بهذه الأسعار</label>}
            {!closed && <Submit>حفظ</Submit>}
          </div>
        </section>
      </form>

      {draft && (
        <form action={addStockLine} className="card flex flex-wrap items-end gap-2 p-4 text-sm">
          <input type="hidden" name="id" value={po.id} />
          <span className="font-bold">إضافة بند للمخزون:</span>
          <input name="sku" required placeholder="SKU الخيار" dir="ltr" className="input w-40" />
          <input name="qty" required placeholder="الكمية" inputMode="numeric" className="input w-24" />
          <input name="price" placeholder={`سعر الوحدة (${po.currency})`} inputMode="decimal" className="input w-36" />
          <Submit className="btn-outline">إضافة</Submit>
        </form>
      )}

      <Attachments entity="PurchaseOrder" entityId={po.id} back={backUrl} canEdit={!closed} />
    </div>
  );
}
