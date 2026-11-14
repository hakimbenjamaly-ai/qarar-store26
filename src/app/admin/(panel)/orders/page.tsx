import Link from "next/link";
import { Prisma, type OrderStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, lyd, normalizePhone } from "@/lib/format";
import { STATUS_LABELS, statusTone } from "@/lib/order-status";
import { Empty, PageHeader } from "@/components/admin/ui";

type SP = { q?: string; status?: string; from?: string; to?: string; city?: string; page?: string };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser("orders.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.OrderWhereInput = {};
  if (sp.status && sp.status in STATUS_LABELS) {
    // البحث بحالة الطلب أو أي بند فيه
    where.OR = [{ status: sp.status as OrderStatus }, { items: { some: { status: sp.status as OrderStatus } } }];
  }
  if (sp.q) {
    const q = sp.q.trim();
    const phone = normalizePhone(q);
    const or: Prisma.OrderWhereInput[] = [{ number: { contains: q, mode: "insensitive" } }, { shipName: { contains: q, mode: "insensitive" } }];
    if (phone) or.push({ shipPhone: phone }, { customer: { phone } });
    where.AND = [{ OR: or }];
  }
  if (sp.city) where.shipCity = sp.city;
  if (sp.from || sp.to) where.createdAt = { gte: sp.from ? new Date(sp.from + "T00:00:00+02:00") : undefined, lte: sp.to ? new Date(sp.to + "T23:59:59+02:00") : undefined };

  const [cities, total, rows] = await Promise.all([
    db.city.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true } }),
    db.order.count({ where }),
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50, include: { _count: { select: { items: true } } } }),
  ]);
  const qs = (p: number) => `?${new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <div>
      <PageHeader title="الطلبات" />
      <form className="card mb-4 flex flex-wrap items-end gap-2 p-3 text-sm">
        <input name="q" defaultValue={sp.q} placeholder="رقم الطلب، الاسم أو الهاتف" className="input w-60" />
        <select name="status" defaultValue={sp.status ?? ""} className="input w-48">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="city" defaultValue={sp.city ?? ""} className="input w-40">
          <option value="">كل المدن</option>
          {cities.map((c) => <option key={c.name}>{c.name}</option>)}
        </select>
        <input type="date" name="from" defaultValue={sp.from} className="input w-40" aria-label="من" />
        <input type="date" name="to" defaultValue={sp.to} className="input w-40" aria-label="إلى" />
        <button className="btn-outline">بحث</button>
      </form>
      {rows.length === 0 ? (
        <Empty>لا توجد طلبات مطابقة.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>رقم الطلب</th><th>التاريخ</th><th>العميل</th><th>الهاتف</th><th>المدينة</th><th>البنود</th><th>الإجمالي</th><th>الحالة</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/orders/${o.id}`} className="font-medium text-brand-700 hover:underline" dir="ltr">{o.number}</Link></td>
                  <td className="whitespace-nowrap">{dateTime(o.createdAt)}</td>
                  <td>{o.shipName}</td>
                  <td dir="ltr" className="text-right">{o.shipPhone}</td>
                  <td>{o.shipCity}</td>
                  <td>{o._count.items}</td>
                  <td>{lyd(o.total)}</td>
                  <td><span className={`badge ${statusTone(o.status)}`}>{STATUS_LABELS[o.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between p-3 text-sm text-gray-500">
            <span>{total} طلب</span>
            <span className="flex gap-3">
              {page > 1 && <Link href={qs(page - 1)}>السابق</Link>}
              {page * 50 < total && <Link href={qs(page + 1)}>التالي</Link>}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
