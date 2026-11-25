import Link from "next/link";
import type { ShipmentStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateOnly } from "@/lib/format";
import { SHIPMENT_STATUS_LABELS } from "@/lib/purchasing";
import { Empty, PageHeader } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { createShipment } from "./actions";

export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireUser("shipping.manage");
  const sp = await searchParams;
  const rows = await db.shipment.findMany({
    where: {
      status: sp.status && sp.status in SHIPMENT_STATUS_LABELS ? (sp.status as ShipmentStatus) : undefined,
      OR: sp.q ? [{ number: { contains: sp.q, mode: "insensitive" } }, { trackingNumber: { contains: sp.q, mode: "insensitive" } }] : undefined,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { carrier: true, _count: { select: { items: true } } },
  });
  const now = Date.now();
  return (
    <div>
      <PageHeader title="الشحنات الدولية" actions={<><Link href="/admin/shipments/carriers" className="btn-outline">شركات الشحن</Link><form action={createShipment}><Submit>+ شحنة جديدة</Submit></form></>} />
      <form className="card mb-4 flex flex-wrap gap-2 p-3 text-sm">
        <input name="q" defaultValue={sp.q} placeholder="رقم الشحنة أو التتبع" className="input w-56" />
        <select name="status" defaultValue={sp.status ?? ""} className="input w-44"><option value="">كل الحالات</option>{Object.entries(SHIPMENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="btn-outline">بحث</button>
      </form>
      {rows.length === 0 ? <Empty>لا توجد شحنات.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>الرقم</th><th>الشركة</th><th>التتبع</th><th>من</th><th>الشحن</th><th>الوصول المتوقع</th><th>البنود</th><th>الحالة</th></tr></thead>
            <tbody>
              {rows.map((s) => {
                const late = s.expectedArrival && s.expectedArrival.getTime() < now && ["PENDING", "IN_TRANSIT", "CUSTOMS"].includes(s.status);
                return (
                  <tr key={s.id}>
                    <td><Link href={`/admin/shipments/${s.id}`} className="font-medium text-brand-700" dir="ltr">{s.number}</Link></td>
                    <td>{s.carrier?.name ?? "—"}</td>
                    <td dir="ltr" className="text-right">{s.trackingNumber || "—"}</td>
                    <td>{s.originCountry || "—"}</td>
                    <td>{dateOnly(s.shippedAt)}</td>
                    <td className={late ? "font-semibold text-red-600" : ""}>{dateOnly(s.expectedArrival)}{late ? " (متأخرة)" : ""}</td>
                    <td>{s._count.items}</td>
                    <td>{SHIPMENT_STATUS_LABELS[s.status]}</td>
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
