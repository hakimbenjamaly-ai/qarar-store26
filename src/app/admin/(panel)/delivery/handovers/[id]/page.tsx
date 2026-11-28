import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, lyd } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { DELIVERY_STATUS_LABELS, deliveryTone } from "@/lib/delivery";
import { Flash } from "@/components/admin/ui";
import { Attachments } from "@/components/admin/attachments";
import { PrintButton } from "../../../orders/[id]/invoice/print-button";

/** كشف التسليم: يُطبع ويوقّعه مندوب النورس عند استلام الطرود */
export default async function HandoverPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser("delivery.manage");
  const { id } = await params;
  const [h, s] = await Promise.all([
    db.handover.findUnique({ where: { id }, include: { partner: true, deliveries: { orderBy: { number: "asc" }, include: { order: true, items: true } } } }),
    getSettings(),
  ]);
  if (!h) notFound();
  const totalCod = h.deliveries.reduce((t, d) => t + Number(d.codAmount), 0);
  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Link href="/admin/delivery/handovers" className="text-sm text-gray-500">→ رجوع</Link>
        <span className="flex-1" />
        <a href={`/admin/delivery/export?handover=${h.id}`} className="btn-outline">تنزيل Excel (CSV) للنورس</a>
        <a href={`/admin/delivery/labels?${new URLSearchParams(h.deliveries.map((d) => ["id", d.id]))}`} target="_blank" className="btn-outline">الملصقات</a>
        <PrintButton />
      </div>
      <div className="no-print"><Flash {...await searchParams} /></div>
      <div className="bg-white p-6 text-sm">
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <div className="text-xl font-bold">كشف تسليم طرود</div>
            <div>{s.storeName} ← {h.partner.name}</div>
          </div>
          <div className="text-left">
            <div className="text-lg font-bold" dir="ltr">{h.number}</div>
            <div>{dateTime(h.handedAt)}</div>
            <div>عدد الطرود: {h.parcelCount}</div>
          </div>
        </div>
        <table className="table mt-3">
          <thead><tr><th>#</th><th>التوصيلة</th><th>الطلب</th><th>العميل</th><th>الهاتف</th><th>المدينة / العنوان</th><th>القطع</th><th>للتحصيل</th><th className="no-print">الحالة الآن</th></tr></thead>
          <tbody>
            {h.deliveries.map((d, k) => (
              <tr key={d.id}>
                <td>{k + 1}</td>
                <td dir="ltr" className="text-right"><Link href={`/admin/delivery/${d.id}`} className="text-brand-700">{d.number}</Link></td>
                <td dir="ltr" className="text-right">{d.order.number}</td>
                <td>{d.order.shipName}</td>
                <td dir="ltr" className="text-right">{d.order.shipPhone}</td>
                <td>{d.order.shipCity} – {d.order.shipAddress}</td>
                <td>{d.items.reduce((t, i) => t + i.quantity, 0)}</td>
                <td>{lyd(d.codAmount)}</td>
                <td className="no-print"><span className={`badge ${deliveryTone(d.status)}`}>{DELIVERY_STATUS_LABELS[d.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 text-base font-bold">إجمالي المطلوب تحصيله: {lyd(totalCod)}</div>
        {h.notes && <p className="mt-2">ملاحظات: {h.notes}</p>}
        <div className="mt-10 grid grid-cols-2 gap-8">
          <div>سلّمها (عن {s.storeName}): ..............................<br /><br />التوقيع: ..............................</div>
          <div>استلمها (عن {h.partner.name}): {h.receivedBy || ".............................."}<br /><br />التوقيع: ..............................</div>
        </div>
      </div>
      <div className="no-print"><Attachments entity="Handover" entityId={h.id} back={`/admin/delivery/handovers/${h.id}`} canEdit /></div>
    </div>
  );
}
