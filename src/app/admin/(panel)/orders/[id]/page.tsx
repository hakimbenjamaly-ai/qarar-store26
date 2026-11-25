import Link from "next/link";
import { notFound } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, lyd } from "@/lib/format";
import { allowedNext, STATUS_LABELS, statusTone } from "@/lib/order-status";
import { Field, Flash, PageHeader } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { addPayment, deletePayment, updateOrderInfo, updateStatus } from "../actions";

const KIND = { DEPOSIT: "عربون", PAYMENT: "دفعة", REFUND: "استرداد" } as const;

function StatusForm({ orderId, itemId, options, compact }: { orderId: string; itemId?: string; options: OrderStatus[]; compact?: boolean }) {
  if (options.length === 0) return <span className="text-xs text-gray-400">لا انتقالات متاحة</span>;
  return (
    <form action={updateStatus} className={`flex flex-wrap items-center gap-2 ${compact ? "text-xs" : "text-sm"}`}>
      <input type="hidden" name="orderId" value={orderId} />
      {itemId && <input type="hidden" name="itemId" value={itemId} />}
      <select name="to" required className="input w-auto py-1" defaultValue="">
        <option value="" disabled>نقل إلى...</option>
        {options.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
      </select>
      <input name="note" placeholder="ملاحظة (اختياري)" className="input w-44 py-1" />
      {options.includes("RETURNED") && <label className="flex items-center gap-1"><input type="checkbox" name="restock" /> إعادة للمخزون</label>}
      <Submit className="btn-outline py-1">تحديث</Submit>
    </form>
  );
}

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const u = await requireUser("orders.view");
  const id = (await params).id;
  const o = await db.order.findUnique({
    where: { id },
    include: {
      customer: { include: { _count: { select: { orders: true } } } },
      items: {
        include: {
          variant: { select: { productId: true } },
          purchaseItems: {
            where: { purchaseOrder: { status: { not: "CANCELLED" } } },
            include: { purchaseOrder: { select: { id: true, number: true } }, shipmentItems: { include: { shipment: { select: { id: true, number: true, trackingNumber: true } } } } },
          },
        },
      },
      history: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } }, orderItem: { select: { productName: true } } } },
      payments: { orderBy: { receivedAt: "asc" }, include: { method: true, createdBy: { select: { name: true } } } },
      paymentMethod: true,
    },
  });
  if (!o) notFound();
  const sp = await searchParams;
  const manage = can(u, "orders.manage");
  const pay = can(u, "payments.manage");
  const costs = can(u, "costs.view");
  const methods = pay ? await db.paymentMethod.findMany({ orderBy: { sortOrder: "asc" } }) : [];

  const paid = o.payments.reduce((s, p) => s + (p.kind === "REFUND" ? -1 : 1) * Number(p.amount), 0);
  const remaining = Number(o.total) - paid;
  const orderOptions = [...new Set(o.items.flatMap((i) => allowedNext(i.status, i.sourcing)))];
  const live = o.items.filter((i) => i.status !== "CANCELLED");
  const unitCost = (i: (typeof o.items)[number]) => i.actualUnitCostLyd ?? i.estUnitCostLyd;
  const estCost = live.reduce((s, i) => s + (unitCost(i) ? Number(unitCost(i)) * i.quantity : 0), 0);
  const missingCost = live.some((i) => unitCost(i) === null);
  const liveRevenue = live.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);

  return (
    <div>
      <PageHeader
        title={`طلب ${o.number}`}
        back="/admin/orders"
        actions={<Link href={`/admin/orders/${o.id}/invoice`} target="_blank" className="btn-outline">طباعة الفاتورة</Link>}
      />
      <Flash {...sp} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className={`badge text-sm ${statusTone(o.status)}`}>{STATUS_LABELS[o.status]}</span>
        <span className="text-sm text-gray-500">{dateTime(o.createdAt)}</span>
        {manage && <div className="mr-auto"><StatusForm orderId={o.id} options={orderOptions} /></div>}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card overflow-x-auto">
            <h2 className="p-4 pb-2 font-bold">البنود</h2>
            <table className="table">
              <thead><tr><th>المنتج</th><th>المصدر</th><th>الكمية</th><th>سعر الوحدة</th>{costs && <th>التكلفة (تقديرية / فعلية)</th>}<th>الحالة</th></tr></thead>
              <tbody>
                {o.items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/admin/products/${i.variant.productId}`} className="hover:text-brand-700">{i.productName}</Link>
                      {i.variantName && <div className="text-xs text-gray-500">{i.variantName}</div>}
                      <div className="text-xs text-gray-400" dir="ltr">{i.sku}</div>
                      {i.purchaseItems.map((pi) => (
                        <div key={pi.id} className="text-xs">
                          <Link href={`/admin/purchase-orders/${pi.purchaseOrder.id}`} className="text-brand-700" dir="ltr">{pi.purchaseOrder.number}</Link>
                          {pi.shipmentItems.map((si) => <span key={si.id}> · <Link href={`/admin/shipments/${si.shipment.id}`} className="text-brand-700" dir="ltr">{si.shipment.number}</Link></span>)}
                        </div>
                      ))}
                    </td>
                    <td>{i.sourcing === "LOCAL_STOCK" ? "مخزون محلي" : "استيراد"}</td>
                    <td>{i.quantity}</td>
                    <td>{lyd(i.unitPrice)}</td>
                    {costs && (
                      <td>
                        {i.estUnitCostLyd ? lyd(i.estUnitCostLyd) : "—"} / {i.actualUnitCostLyd ? <b>{lyd(i.actualUnitCostLyd)}</b> : "—"}
                      </td>
                    )}
                    <td className="space-y-1">
                      <span className={`badge ${statusTone(i.status)}`}>{STATUS_LABELS[i.status]}</span>
                      {manage && o.items.length > 1 && <StatusForm compact orderId={o.id} itemId={i.id} options={allowedNext(i.status, i.sourcing)} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="grid gap-1 p-4 text-sm sm:max-w-xs">
              <div className="flex justify-between"><span>المجموع</span><span>{lyd(o.subtotal)}</span></div>
              <div className="flex justify-between"><span>الخصم</span><span>{lyd(o.discount)}</span></div>
              <div className="flex justify-between"><span>التوصيل</span><span>{lyd(o.deliveryFee)}</span></div>
              <div className="flex justify-between font-bold"><span>الإجمالي</span><span>{lyd(o.total)}</span></div>
              {costs && (
                <div className="mt-2 flex justify-between border-t pt-2 text-gray-600">
                  <span>الربح{missingCost ? " (تكلفة ناقصة)" : ""}</span>
                  <span>{lyd(liveRevenue - Number(o.discount) - estCost)}</span>
                </div>
              )}
            </div>
          </section>

          <section className="card overflow-x-auto">
            <h2 className="p-4 pb-2 font-bold">الدفعات والتحصيل</h2>
            <div className="grid grid-cols-2 gap-3 px-4 text-sm sm:grid-cols-4">
              <div><div className="text-gray-500">طريقة الدفع</div><div>{o.paymentMethod?.name ?? "—"}</div></div>
              <div><div className="text-gray-500">العربون المطلوب</div><div>{lyd(o.depositRequired)}</div></div>
              <div><div className="text-gray-500">المدفوع</div><div>{lyd(paid)}</div></div>
              <div><div className="text-gray-500">المتبقي</div><div className={remaining > 0 ? "font-bold text-amber-700" : "font-bold text-emerald-700"}>{lyd(remaining)}</div></div>
            </div>
            <table className="table mt-3">
              <thead><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>الطريقة</th><th>المرجع</th><th>سجّلها</th><th></th></tr></thead>
              <tbody>
                {o.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{dateTime(p.receivedAt)}</td>
                    <td>{KIND[p.kind]}</td>
                    <td>{lyd(p.amount)}</td>
                    <td>{p.method?.name ?? "—"}</td>
                    <td>{p.reference}{p.receiptUrl && <> · <a href={p.receiptUrl} target="_blank" className="text-brand-700 underline">الإيصال</a></>}</td>
                    <td>{p.createdBy?.name ?? "—"}</td>
                    <td>{pay && <form action={deletePayment}><input type="hidden" name="id" value={p.id} /><Submit className="text-xs text-red-600" confirm="تأكيد؟">حذف</Submit></form>}</td>
                  </tr>
                ))}
                {o.payments.length === 0 && <tr><td colSpan={7} className="text-gray-500">لا توجد دفعات مسجلة.</td></tr>}
              </tbody>
            </table>
            {pay && (
              <form action={addPayment} className="grid gap-2 p-4 text-sm sm:grid-cols-3">
                <input type="hidden" name="orderId" value={o.id} />
                <select name="kind" className="input" defaultValue="PAYMENT">
                  <option value="DEPOSIT">عربون</option>
                  <option value="PAYMENT">دفعة</option>
                  <option value="REFUND">استرداد</option>
                </select>
                <input name="amount" required inputMode="decimal" placeholder="المبلغ د.ل" className="input" defaultValue={remaining > 0 ? remaining : ""} />
                <select name="methodId" className="input" defaultValue={o.paymentMethodId ?? ""}>
                  <option value="">الطريقة</option>
                  {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <input name="reference" placeholder="رقم المرجع / التحويل" className="input" />
                <input name="receivedAt" type="datetime-local" className="input" aria-label="تاريخ الاستلام" />
                <input name="receipt" type="file" accept="image/*,application/pdf" className="text-xs" aria-label="صورة الإيصال" />
                <input name="note" placeholder="ملاحظة" className="input sm:col-span-2" />
                <Submit>تسجيل الدفعة</Submit>
              </form>
            )}
          </section>

          <section className="card p-4">
            <h2 className="mb-3 font-bold">سجل الحالات</h2>
            <ul className="space-y-2 text-sm">
              {o.history.map((h) => (
                <li key={h.id} className="flex flex-wrap gap-x-3 border-b pb-2">
                  <span className="text-gray-500">{dateTime(h.createdAt)}</span>
                  <span>{h.orderItem ? `بند «${h.orderItem.productName}»` : "الطلب"}: {h.fromStatus ? `${STATUS_LABELS[h.fromStatus]} ← ` : ""}<b>{STATUS_LABELS[h.toStatus]}</b></span>
                  {h.note && <span className="text-gray-600">({h.note})</span>}
                  <span className="text-gray-400">{h.user?.name ?? "النظام"}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card space-y-1 p-4 text-sm">
            <h2 className="mb-2 font-bold">العميل</h2>
            <Link href={`/admin/customers/${o.customerId}`} className="font-medium text-brand-700 hover:underline">{o.customer.fullName}</Link>
            <div dir="ltr" className="text-right">{o.shipPhone}</div>
            {o.shipWhatsapp && <a className="block text-brand-700" href={`https://wa.me/218${o.shipWhatsapp.slice(1)}`} target="_blank">واتساب: {o.shipWhatsapp}</a>}
            <div className="text-gray-500">{o.customer._count.orders} طلب لهذا العميل</div>
            {o.customerNote && <div className="mt-2 rounded bg-amber-50 p-2">ملاحظة العميل: {o.customerNote}</div>}
          </section>
          <form action={updateOrderInfo} className="card space-y-3 p-4 text-sm">
            <h2 className="font-bold">بيانات التوصيل</h2>
            <input type="hidden" name="orderId" value={o.id} />
            <fieldset disabled={!manage} className="space-y-3">
              <Field label="الاسم"><input name="shipName" defaultValue={o.shipName} className="input" /></Field>
              <Field label="المدينة"><input value={o.shipCity} disabled className="input bg-gray-50" readOnly /></Field>
              <Field label="المنطقة"><input name="shipRegion" defaultValue={o.shipRegion} className="input" /></Field>
              <Field label="العنوان"><input name="shipAddress" defaultValue={o.shipAddress} className="input" /></Field>
              <Field label="أقرب نقطة دالة"><input name="shipLandmark" defaultValue={o.shipLandmark} className="input" /></Field>
              <Field label="واتساب"><input name="shipWhatsapp" defaultValue={o.shipWhatsapp ?? ""} dir="ltr" className="input" /></Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="الخصم"><input name="discount" defaultValue={String(o.discount)} inputMode="decimal" className="input" /></Field>
                <Field label="التوصيل"><input name="deliveryFee" defaultValue={String(o.deliveryFee)} inputMode="decimal" className="input" /></Field>
                <Field label="العربون"><input name="depositRequired" defaultValue={String(o.depositRequired)} inputMode="decimal" className="input" /></Field>
              </div>
              <Field label="ملاحظات داخلية"><textarea name="internalNote" defaultValue={o.internalNote} rows={3} className="input" /></Field>
              {manage && <Submit>حفظ</Submit>}
            </fieldset>
          </form>
        </aside>
      </div>
    </div>
  );
}
