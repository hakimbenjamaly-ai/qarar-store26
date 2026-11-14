import Link from "next/link";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateOnly, lyd, normalizePhone } from "@/lib/format";
import { Empty, PageHeader } from "@/components/admin/ui";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireUser("customers.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").trim();
  const where: Prisma.CustomerWhereInput = {};
  if (q) {
    const phone = normalizePhone(q);
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { phone: { contains: phone ?? q } },
      { whatsapp: { contains: phone ?? q } },
      { orders: { some: { number: { contains: q, mode: "insensitive" } } } },
    ];
  }
  const [total, rows] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50, include: { _count: { select: { orders: true } }, addresses: { take: 1, orderBy: { createdAt: "desc" }, include: { city: true } } } }),
  ]);
  const sums = await db.order.groupBy({ by: ["customerId"], where: { customerId: { in: rows.map((r) => r.id) }, status: { notIn: ["CANCELLED", "RETURNED"] } }, _sum: { total: true } });
  return (
    <div>
      <PageHeader title="العملاء" />
      <form className="card mb-4 flex gap-2 p-3 text-sm">
        <input name="q" defaultValue={q} placeholder="بحث بالاسم أو رقم الهاتف أو رقم الطلب" className="input max-w-md" />
        <button className="btn-outline">بحث</button>
      </form>
      {rows.length === 0 ? (
        <Empty>لا يوجد عملاء. يُسجَّل العميل تلقائياً عند أول طلب.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>الاسم</th><th>الهاتف</th><th>واتساب</th><th>المدينة</th><th>الطلبات</th><th>إجمالي المشتريات</th><th>منذ</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/admin/customers/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.fullName}</Link></td>
                  <td dir="ltr" className="text-right">{c.phone}</td>
                  <td dir="ltr" className="text-right">{c.whatsapp ?? "—"}</td>
                  <td>{c.addresses[0]?.city.name ?? "—"}</td>
                  <td>{c._count.orders}</td>
                  <td>{lyd(sums.find((s) => s.customerId === c.id)?._sum.total)}</td>
                  <td>{dateOnly(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between p-3 text-sm text-gray-500">
            <span>{total} عميل</span>
            <span className="flex gap-3">
              {page > 1 && <Link href={`?q=${encodeURIComponent(q)}&page=${page - 1}`}>السابق</Link>}
              {page * 50 < total && <Link href={`?q=${encodeURIComponent(q)}&page=${page + 1}`}>التالي</Link>}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
