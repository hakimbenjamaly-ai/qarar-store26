import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateOnly, lyd } from "@/lib/format";
import { readyQueue } from "@/lib/delivery";
import { STATUS_LABELS } from "@/lib/order-status";
import { Empty, Flash, PageHeader } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { DeliveryTabs } from "./tabs";
import { prepareDeliveries } from "./actions";

export default async function ReadyPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; city?: string }> }) {
  await requireUser("delivery.manage");
  const sp = await searchParams;
  const [queue, partners] = await Promise.all([readyQueue(), db.deliveryPartner.findMany({ where: { active: true }, orderBy: { name: "asc" } })]);
  const rows = sp.city ? queue.filter((q) => q.order.shipCity === sp.city) : queue;
  const cities = [...new Set(queue.map((q) => q.order.shipCity))].sort();
  return (
    <div>
      <PageHeader title="التوزيع المحلي" />
      <DeliveryTabs active="/admin/delivery" />
      <Flash ok={sp.ok} err={sp.err} />
      <p className="mb-4 text-sm text-gray-600">طلبات بنودها جاهزة للتوصيل: المستوردة بعد «وصل إلى ليبيا» والمحلية بعد «قيد تأكيد الطلب». حدّد الطلبات لتجهيز طرد لكل منها، ثم اطبع الملصقات وأنشئ دفعة تسليم للنورس.</p>
      {partners.length === 0 && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">لم تُضف شركة توزيع بعد. أضفها من <Link href="/admin/delivery/partners" className="underline">الشركة والنقاط</Link>.</p>}
      {cities.length > 1 && (
        <form className="mb-3 flex gap-2 text-sm">
          <select name="city" defaultValue={sp.city ?? ""} className="input w-44" aria-label="المدينة"><option value="">كل المدن</option>{cities.map((c) => <option key={c}>{c}</option>)}</select>
          <button className="btn-outline">تصفية</button>
        </form>
      )}
      {rows.length === 0 ? <Empty>لا توجد طلبات جاهزة للتوصيل حالياً.</Empty> : (
        <form action={prepareDeliveries} className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th></th><th>الطلب</th><th>التاريخ</th><th>العميل</th><th>المدينة</th><th>البنود الجاهزة</th><th>ينتظر</th><th>الإجمالي</th></tr></thead>
            <tbody>
              {rows.map(({ order: o, ready, waiting }) => (
                <tr key={o.id}>
                  <td><input type="checkbox" name="orderId" value={o.id} aria-label={`تحديد ${o.number}`} /></td>
                  <td><Link href={`/admin/orders/${o.id}`} className="text-brand-700" dir="ltr">{o.number}</Link></td>
                  <td>{dateOnly(o.createdAt)}</td>
                  <td>{o.shipName}<div className="text-xs text-gray-500" dir="ltr">{o.shipPhone}</div></td>
                  <td>{o.shipCity}{o.shipRegion && <div className="text-xs text-gray-500">{o.shipRegion}</div>}</td>
                  <td>{ready.map((i) => <div key={i.id}>{i.productName} × {i.quantity}</div>)}</td>
                  <td className="text-xs">{waiting.length === 0 ? "—" : <span className="text-amber-700">{waiting.map((i) => `${i.productName} (${STATUS_LABELS[i.status]})`).join("، ")}</span>}</td>
                  <td>{lyd(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-2 p-4 text-sm">
            <select name="partnerId" required className="input w-56" aria-label="شركة التوزيع">{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <Submit>تجهيز طرود للمحدد</Submit>
            <span className="text-xs text-gray-500">الطلبات التي ينتظر بعض بنودها تُجهَّز بالبنود الجاهزة فقط (توصيل جزئي).</span>
          </div>
        </form>
      )}
    </div>
  );
}
