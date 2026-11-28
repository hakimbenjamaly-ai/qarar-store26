import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { Empty, PageHeader } from "@/components/admin/ui";
import { DeliveryTabs } from "../tabs";

export default async function Handovers() {
  await requireUser("delivery.manage");
  const rows = await db.handover.findMany({ orderBy: { handedAt: "desc" }, take: 200, include: { partner: true, deliveries: { select: { status: true } } } });
  return (
    <div>
      <PageHeader title="دفعات التسليم للنورس" />
      <DeliveryTabs active="/admin/delivery/handovers" />
      {rows.length === 0 ? <Empty>لا توجد دفعات بعد. جهّز الطرود ثم سلّمها من «التوصيلات» ← الجاهزة.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>الدفعة</th><th>التاريخ</th><th>الشركة</th><th>المستلم</th><th>الطرود</th><th>سُلّم للعملاء</th><th>جارية</th><th>تعذر/مرتجع</th></tr></thead>
            <tbody>
              {rows.map((h) => {
                const c = (f: (s: string) => boolean) => h.deliveries.filter((d) => f(d.status)).length;
                return (
                  <tr key={h.id}>
                    <td><Link href={`/admin/delivery/handovers/${h.id}`} className="font-medium text-brand-700" dir="ltr">{h.number}</Link></td>
                    <td>{dateTime(h.handedAt)}</td>
                    <td>{h.partner.name}</td>
                    <td>{h.receivedBy || "—"}</td>
                    <td>{h.parcelCount}</td>
                    <td>{c((s) => s === "DELIVERED")}</td>
                    <td>{c((s) => ["HANDED_OVER", "IN_DISTRIBUTION", "OUT_FOR_DELIVERY"].includes(s))}</td>
                    <td>{c((s) => s === "FAILED" || s === "RETURNED")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
