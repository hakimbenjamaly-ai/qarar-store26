import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { Empty, PageHeader } from "@/components/admin/ui";
import { DeliveryTabs } from "../tabs";

export default async function Returns() {
  await requireUser("delivery.manage");
  const rows = await db.return.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { orderItem: { include: { order: true } }, delivery: true } });
  return (
    <div>
      <PageHeader title="المرتجعات" />
      <DeliveryTabs active="/admin/delivery/returns" />
      {rows.length === 0 ? <Empty>لا توجد مرتجعات.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>التاريخ</th><th>الطلب</th><th>المنتج</th><th>الكمية</th><th>السبب</th><th>التوصيلة</th><th>المخزون</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{dateTime(r.createdAt)}</td>
                  <td><Link href={`/admin/orders/${r.orderItem.orderId}`} className="text-brand-700" dir="ltr">{r.orderItem.order.number}</Link></td>
                  <td>{r.orderItem.productName} <span className="text-xs text-gray-500">{r.orderItem.variantName}</span></td>
                  <td>{r.quantity}</td>
                  <td>{r.reason}</td>
                  <td>{r.delivery ? <Link href={`/admin/delivery/${r.deliveryId}`} className="text-brand-700" dir="ltr">{r.delivery.number}</Link> : "—"}</td>
                  <td>{r.restocked ? "أُعيد للمخزون" : "لم يُعد"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
