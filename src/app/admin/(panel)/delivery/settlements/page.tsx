import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateOnly, lyd } from "@/lib/format";
import { Empty, PageHeader, Stat } from "@/components/admin/ui";
import { DeliveryTabs } from "../tabs";

export default async function Settlements() {
  await requireUser("payments.manage");
  const [rows, pending] = await Promise.all([
    db.settlement.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { partner: true, _count: { select: { deliveries: true } } } }),
    db.delivery.aggregate({ where: { settlementId: null, status: "DELIVERED" }, _sum: { collected: true, fee: true }, _count: true }),
  ]);
  return (
    <div>
      <PageHeader title="التسويات مع النورس" actions={<Link href="/admin/delivery/settlements/new" className="btn-primary">+ تسوية جديدة</Link>} />
      <DeliveryTabs active="/admin/delivery/settlements" />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="محصّل لدى النورس بانتظار التسوية" value={lyd(pending._sum.collected ?? 0)} tone="text-amber-700" />
        <Stat label="توصيلات مسلّمة غير مسوّاة" value={pending._count} />
        <Stat label="أجور توصيل مستحقة عليها" value={lyd(pending._sum.fee ?? 0)} />
      </div>
      {rows.length === 0 ? <Empty>لا توجد تسويات بعد.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>الرقم</th><th>الشركة</th><th>الفترة</th><th>التوصيلات</th><th>المحصّل</th><th>الأجور</th><th>الصافي المستلم</th><th>الفرق</th></tr></thead>
            <tbody>
              {rows.map((s) => {
                const diff = Number(s.netReceived) - (Number(s.collected) - Number(s.feesDeducted));
                return (
                  <tr key={s.id}>
                    <td><Link href={`/admin/delivery/settlements/${s.id}`} className="font-medium text-brand-700" dir="ltr">{s.number}</Link></td>
                    <td>{s.partner.name}</td>
                    <td>{dateOnly(s.periodFrom)} – {dateOnly(s.periodTo)}</td>
                    <td>{s._count.deliveries}</td>
                    <td>{lyd(s.collected)}</td>
                    <td>{lyd(s.feesDeducted)}</td>
                    <td>{lyd(s.netReceived)}</td>
                    <td className={Math.abs(diff) >= 0.01 ? "font-semibold text-red-700" : ""}>{Math.abs(diff) >= 0.01 ? lyd(diff) : "—"}</td>
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
