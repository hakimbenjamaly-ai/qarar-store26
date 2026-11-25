import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Empty, Flash, PageHeader } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { createStockPO } from "../actions";

export default async function NewStockPO({ searchParams }: { searchParams: Promise<{ supplier?: string; err?: string }> }) {
  await requireUser("purchasing.manage");
  const sp = await searchParams;
  const suppliers = await db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return (
    <div className="max-w-lg">
      <PageHeader title="أمر شراء للمخزون" back="/admin/purchase-orders" />
      <p className="mb-4 text-sm text-gray-600">لشراء كميات تُخزَّن في ليبيا وتباع لاحقاً. تُضاف الكمية للمخزون المحلي عند تسجيل استلام الشحنة.</p>
      <Flash err={sp.err} />
      {suppliers.length === 0 ? <Empty>أضف مورداً أولاً من صفحة الموردين.</Empty> : (
        <form action={createStockPO} className="card flex gap-2 p-4">
          <select name="supplierId" defaultValue={sp.supplier ?? ""} required className="input">
            <option value="" disabled>اختر المورد</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Submit>إنشاء</Submit>
        </form>
      )}
    </div>
  );
}
