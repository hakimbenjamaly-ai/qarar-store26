import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateOnly, dateTime, lyd } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { DELIVERY_STATUS_LABELS } from "@/lib/delivery";
import { Flash } from "@/components/admin/ui";
import { Attachments } from "@/components/admin/attachments";
import { PrintButton } from "../../../orders/[id]/invoice/print-button";

export default async function SettlementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser("payments.manage");
  const { id } = await params;
  const [s, st] = await Promise.all([
    db.settlement.findUnique({ where: { id }, include: { partner: true, deliveries: { orderBy: { number: "asc" }, include: { order: true } } } }),
    getSettings(),
  ]);
  if (!s) notFound();
  const expected = Number(s.collected) - Number(s.feesDeducted);
  const diff = Number(s.netReceived) - expected;
  return (
    <div className="space-y-4">
      <div className="no-print flex items-center gap-2"><Link href="/admin/delivery/settlements" className="text-sm text-gray-500">→ رجوع</Link><span className="flex-1" /><PrintButton /></div>
      <div className="no-print"><Flash {...await searchParams} /></div>
      <div className="bg-white p-6 text-sm">
        <div className="flex items-start justify-between border-b pb-3">
          <div><div className="text-xl font-bold">كشف تسوية</div><div>{st.storeName} / {s.partner.name}</div></div>
          <div className="text-left"><div className="text-lg font-bold" dir="ltr">{s.number}</div><div>{dateOnly(s.periodFrom)} – {dateOnly(s.periodTo)}</div><div>استُلم: {dateTime(s.receivedAt)}</div>{s.reference && <div>المرجع: {s.reference}</div>}</div>
        </div>
        <table className="table mt-3">
          <thead><tr><th>التوصيلة</th><th>الطلب</th><th>العميل</th><th>الحالة</th><th>المطلوب</th><th>المحصّل</th><th>الأجرة</th></tr></thead>
          <tbody>
            {s.deliveries.map((d) => (
              <tr key={d.id}>
                <td dir="ltr" className="text-right"><Link href={`/admin/delivery/${d.id}`} className="text-brand-700">{d.number}</Link></td>
                <td dir="ltr" className="text-right"><Link href={`/admin/orders/${d.orderId}`} className="text-brand-700">{d.order.number}</Link></td>
                <td>{d.order.shipName}</td>
                <td>{DELIVERY_STATUS_LABELS[d.status]}</td>
                <td>{lyd(d.codAmount)}</td>
                <td>{lyd(d.collected ?? 0)}</td>
                <td>{lyd(d.fee)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mr-auto mt-4 max-w-xs space-y-1">
          <div className="flex justify-between"><dt>إجمالي المحصّل</dt><dd>{lyd(s.collected)}</dd></div>
          <div className="flex justify-between"><dt>الأجور المخصومة</dt><dd>{lyd(s.feesDeducted)}</dd></div>
          <div className="flex justify-between"><dt>الصافي المتوقع</dt><dd>{lyd(expected)}</dd></div>
          <div className="flex justify-between font-bold"><dt>الصافي المستلم</dt><dd>{lyd(s.netReceived)}</dd></div>
          {Math.abs(diff) >= 0.01 && <div className="flex justify-between font-bold text-red-700"><dt>الفرق</dt><dd>{lyd(diff)}</dd></div>}
        </dl>
        {s.notes && <p className="mt-3">ملاحظات: {s.notes}</p>}
      </div>
      <div className="no-print"><Attachments entity="Settlement" entityId={s.id} back={`/admin/delivery/settlements/${s.id}`} canEdit /></div>
    </div>
  );
}
