import Link from "next/link";
import type { PurchaseOrderStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { PO_STATUS_LABELS } from "@/lib/purchasing";
import { Empty, PageHeader } from "@/components/admin/ui";

export default async function POList({ searchParams }: { searchParams: Promise<{ status?: string; supplier?: string; q?: string }> }) {
  await requireUser("purchasing.manage");
  const sp = await searchParams;
  const [suppliers, rows] = await Promise.all([
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    db.purchaseOrder.findMany({
      where: {
        status: sp.status && sp.status in PO_STATUS_LABELS ? (sp.status as PurchaseOrderStatus) : undefined,
        supplierId: sp.supplier || undefined,
        OR: sp.q ? [{ number: { contains: sp.q, mode: "insensitive" } }, { supplierOrderNo: { contains: sp.q } }, { invoiceNo: { contains: sp.q } }] : undefined,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { supplier: true, _count: { select: { items: true } } },
    }),
  ]);
  return (
    <div>
      <PageHeader title="أوامر الشراء" actions={<><Link href="/admin/purchasing" className="btn-outline">بانتظار الشراء</Link><Link href="/admin/purchase-orders/new" className="btn-primary">+ أمر للمخزون</Link></>} />
      <form className="card mb-4 flex flex-wrap gap-2 p-3 text-sm">
        <input name="q" defaultValue={sp.q} placeholder="رقم الأمر أو رقم المورد أو الفاتورة" className="input w-64" />
        <select name="supplier" defaultValue={sp.supplier ?? ""} className="input w-48"><option value="">كل الموردين</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select name="status" defaultValue={sp.status ?? ""} className="input w-44"><option value="">كل الحالات</option>{Object.entries(PO_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="btn-outline">بحث</button>
      </form>
      {rows.length === 0 ? <Empty>لا توجد أوامر شراء.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>الرقم</th><th>التاريخ</th><th>المورد</th><th>رقم الطلب لدى المورد</th><th>الفاتورة</th><th>البنود</th><th>الإجمالي</th><th>الحالة</th></tr></thead>
            <tbody>
              {rows.map((po) => (
                <tr key={po.id}>
                  <td><Link href={`/admin/purchase-orders/${po.id}`} className="font-medium text-brand-700" dir="ltr">{po.number}</Link></td>
                  <td>{dateTime(po.createdAt)}</td>
                  <td>{po.supplier.name}</td>
                  <td dir="ltr" className="text-right">{po.supplierOrderNo || "—"}</td>
                  <td dir="ltr" className="text-right">{po.invoiceNo || "—"}</td>
                  <td>{po._count.items}</td>
                  <td>{Number(po.total).toLocaleString("ar-LY")} {po.currency}</td>
                  <td>{PO_STATUS_LABELS[po.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
