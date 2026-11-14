import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { PageHeader } from "@/components/admin/ui";

const ENTITY_LINK: Record<string, (id: string) => string> = {
  Order: (id) => `/admin/orders/${id}`,
  Product: (id) => `/admin/products/${id}`,
  Customer: (id) => `/admin/customers/${id}`,
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string; user?: string; page?: string }> }) {
  await requireUser("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = { entity: sp.entity || undefined, userId: sp.user || undefined };
  const [users, entities, rows] = await Promise.all([
    db.user.findMany({ select: { id: true, name: true } }),
    db.auditLog.findMany({ distinct: ["entity"], select: { entity: true } }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 100, take: 100, include: { user: { select: { name: true } } } }),
  ]);
  return (
    <div>
      <PageHeader title="سجل العمليات" />
      <form className="card mb-4 flex flex-wrap gap-2 p-3 text-sm">
        <select name="entity" defaultValue={sp.entity ?? ""} className="input w-48"><option value="">كل السجلات</option>{entities.map((e) => <option key={e.entity}>{e.entity}</option>)}</select>
        <select name="user" defaultValue={sp.user ?? ""} className="input w-48"><option value="">كل المستخدمين</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <button className="btn-outline">تصفية</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>السجل</th><th>التفاصيل</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const link = ENTITY_LINK[r.entity]?.(r.entityId);
              return (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{dateTime(r.createdAt)}</td>
                  <td>{r.user?.name ?? "—"}</td>
                  <td>{r.action}</td>
                  <td>{link ? <Link href={link} className="text-brand-700">{r.entity}</Link> : r.entity}</td>
                  <td>
                    {(r.before || r.after) && (
                      <details>
                        <summary className="cursor-pointer text-xs text-brand-700">عرض</summary>
                        <pre dir="ltr" className="max-h-64 max-w-xl overflow-auto rounded bg-gray-50 p-2 text-left text-[11px]">{JSON.stringify({ before: r.before, after: r.after }, null, 2)}</pre>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex gap-3 p-3 text-sm">
          {page > 1 && <Link href={`?${new URLSearchParams({ ...sp, page: String(page - 1) } as Record<string, string>)}`}>السابق</Link>}
          {rows.length === 100 && <Link href={`?${new URLSearchParams({ ...sp, page: String(page + 1) } as Record<string, string>)}`}>التالي</Link>}
        </div>
      </div>
    </div>
  );
}
