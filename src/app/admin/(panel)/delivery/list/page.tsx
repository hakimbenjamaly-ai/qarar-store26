import Link from "next/link";
import type { DeliveryStatus, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, lyd } from "@/lib/format";
import { DELIVERY_STATUS_LABELS, deliveryTone } from "@/lib/delivery";
import { Empty, Flash, PageHeader } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { DeliveryTabs } from "../tabs";
import { createHandover } from "../actions";

export default async function DeliveriesList({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; status?: string; q?: string; partner?: string }> }) {
  await requireUser("delivery.manage");
  const sp = await searchParams;
  const status = sp.status && sp.status in DELIVERY_STATUS_LABELS ? (sp.status as DeliveryStatus) : undefined;
  const where: Prisma.DeliveryWhereInput = {
    status: status ?? (sp.status === "all" ? undefined : { notIn: ["DELIVERED", "RETURNED", "CANCELLED"] }),
    partnerId: sp.partner || undefined,
    OR: sp.q
      ? [
          { number: { contains: sp.q, mode: "insensitive" } },
          { waybillNo: { contains: sp.q, mode: "insensitive" } },
          { order: { number: { contains: sp.q, mode: "insensitive" } } },
          { order: { shipPhone: { contains: sp.q } } },
          { order: { shipName: { contains: sp.q, mode: "insensitive" } } },
        ]
      : undefined,
  };
  const [rows, partners] = await Promise.all([
    db.delivery.findMany({ where, orderBy: { createdAt: "desc" }, take: 300, include: { order: true, partner: true, handover: true } }),
    db.deliveryPartner.findMany({ orderBy: { name: "asc" } }),
  ]);
  const ready = status === "READY";
  const readyPartners = [...new Set(rows.map((r) => r.partnerId))];
  const exportHref = `/admin/delivery/export?${new URLSearchParams({ status: sp.status ?? "", partner: sp.partner ?? "", q: sp.q ?? "" })}`;

  const table = (
    <table className="table">
      <thead><tr>{ready && <th></th>}<th>التوصيلة</th><th>الطلب</th><th>العميل</th><th>المدينة</th><th>الشركة</th><th>الدفعة</th><th>للتحصيل</th><th>المحصّل</th><th>المحاولات</th><th>الحالة</th><th>آخر تحديث</th></tr></thead>
      <tbody>
        {rows.map((d) => (
          <tr key={d.id}>
            {ready && <td><input type="checkbox" name="deliveryId" value={d.id} defaultChecked aria-label={`تحديد ${d.number}`} /></td>}
            <td><Link href={`/admin/delivery/${d.id}`} className="font-medium text-brand-700" dir="ltr">{d.number}</Link>{d.waybillNo && <div className="text-xs text-gray-500" dir="ltr">{d.waybillNo}</div>}</td>
            <td><Link href={`/admin/orders/${d.orderId}`} className="text-brand-700" dir="ltr">{d.order.number}</Link></td>
            <td>{d.order.shipName}<div className="text-xs text-gray-500" dir="ltr">{d.order.shipPhone}</div></td>
            <td>{d.order.shipCity}</td>
            <td>{d.partner.name}</td>
            <td>{d.handover ? <Link href={`/admin/delivery/handovers/${d.handoverId}`} className="text-brand-700" dir="ltr">{d.handover.number}</Link> : "—"}</td>
            <td>{lyd(d.codAmount)}</td>
            <td>{d.collected === null ? "—" : lyd(d.collected)}{d.settlementId && <div className="text-xs text-emerald-700">مُسوّى</div>}</td>
            <td>{d.attempts}</td>
            <td><span className={`badge ${deliveryTone(d.status)}`}>{DELIVERY_STATUS_LABELS[d.status]}</span>{d.status === "FAILED" && <div className="text-xs text-red-700">{d.failureReason}</div>}</td>
            <td className="text-xs">{dateTime(d.updatedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div>
      <PageHeader title="التوصيلات" actions={<><a href={exportHref} className="btn-outline">تنزيل Excel (CSV)</a></>} />
      <DeliveryTabs active="/admin/delivery/list" />
      <Flash ok={sp.ok} err={sp.err} />
      <form className="card mb-4 flex flex-wrap gap-2 p-3 text-sm">
        <input name="q" defaultValue={sp.q} placeholder="رقم التوصيلة أو الطلب أو البوليصة أو الهاتف" className="input w-72" />
        <select name="status" defaultValue={sp.status ?? ""} className="input w-48" aria-label="الحالة">
          <option value="">الجارية فقط</option>
          <option value="all">كل الحالات</option>
          {Object.entries(DELIVERY_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {partners.length > 1 && <select name="partner" defaultValue={sp.partner ?? ""} className="input w-44" aria-label="الشركة"><option value="">كل الشركات</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
        <button className="btn-outline">بحث</button>
      </form>
      {rows.length === 0 ? <Empty>لا توجد توصيلات مطابقة.</Empty> : ready ? (
        <form action={createHandover} className="card overflow-x-auto">
          {table}
          <div className="flex flex-wrap items-center gap-2 border-t p-4 text-sm">
            <b>دفعة تسليم للنورس:</b>
            <select name="partnerId" className="input w-44" aria-label="الشركة">{partners.filter((p) => readyPartners.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <input name="receivedBy" placeholder="اسم مندوب النورس المستلم" className="input w-56" />
            <input name="notes" placeholder="ملاحظات" className="input w-56" />
            <Submit>تسليم المحدد للنورس</Submit>
            <a href={`/admin/delivery/labels?${new URLSearchParams(rows.map((r) => ["id", r.id]))}`} target="_blank" className="btn-outline">طباعة الملصقات</a>
          </div>
        </form>
      ) : (
        <div className="card overflow-x-auto">{table}</div>
      )}
    </div>
  );
}
