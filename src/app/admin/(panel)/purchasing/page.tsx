import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateOnly } from "@/lib/format";
import { purchaseQueue } from "@/lib/purchasing";
import { Empty, Flash, PageHeader } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { createFromQueue } from "../purchase-orders/actions";

export default async function PurchasingQueue({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser("purchasing.manage");
  const [items, suppliers] = await Promise.all([purchaseQueue(), db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } })]);

  // تجميع حسب المورد المقترح: المورد المسجل في تكلفة المنتج، وإلا أول مورد مربوط ومتوفر
  const groups = new Map<string, { supplier: { id: string; name: string; currency: string } | null; items: typeof items }>();
  for (const it of items) {
    const sid = it.variant.cost?.supplierId ?? it.variant.supplierProducts.find((p) => p.available)?.supplierId ?? "";
    const sup = suppliers.find((s) => s.id === sid) ?? null;
    const g = groups.get(sid) ?? { supplier: sup ? { id: sup.id, name: sup.name, currency: sup.currency } : null, items: [] };
    g.items.push(it);
    groups.set(sid, g);
  }

  return (
    <div>
      <PageHeader title="بانتظار الشراء" actions={<Link href="/admin/purchase-orders/new" className="btn-outline">أمر شراء للمخزون</Link>} />
      <p className="mb-4 text-sm text-gray-600">بنود الطلبات المستوردة التي نُقلت إلى «قيد الشراء من المورد» ولم يُنشأ لها أمر شراء. اختر البنود والمورد لإنشاء أمر شراء (مسودة) ثم أكمل بياناته بعد الشراء من موقع المورد.</p>
      <Flash {...await searchParams} />
      {items.length === 0 ? (
        <Empty>لا توجد بنود بانتظار الشراء. انقل الطلبات المؤكدة إلى «قيد الشراء من المورد» من صفحة الطلب.</Empty>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([sid, g]) => (
            <form key={sid} action={createFromQueue} className="card overflow-x-auto">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <h2 className="font-bold">{g.supplier ? g.supplier.name : "بدون مورد محدد"}</h2>
                <span className="text-sm text-gray-500">{g.items.length} بند</span>
                <div className="mr-auto flex flex-wrap items-center gap-2 text-sm">
                  <select name="supplierId" defaultValue={g.supplier?.id ?? ""} required className="input w-52" aria-label="المورد">
                    <option value="" disabled>اختر المورد</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input name="currency" defaultValue={g.supplier?.currency ?? ""} placeholder="العملة" dir="ltr" className="input w-20" aria-label="العملة" />
                  <Submit>إنشاء أمر شراء من المحدد</Submit>
                </div>
              </div>
              <table className="table">
                <thead><tr><th></th><th>الطلب</th><th>المنتج</th><th>الكمية</th><th>لدى المورد</th></tr></thead>
                <tbody>
                  {g.items.map((it) => {
                    const links = it.variant.supplierProducts;
                    return (
                      <tr key={it.id}>
                        <td><input type="checkbox" name="itemId" value={it.id} defaultChecked aria-label="تحديد" /></td>
                        <td><Link href={`/admin/orders/${it.order.id}`} className="text-brand-700" dir="ltr">{it.order.number}</Link><div className="text-xs text-gray-500">{dateOnly(it.order.createdAt)}</div></td>
                        <td>{it.productName}{it.variantName ? ` (${it.variantName})` : ""}<div className="text-xs text-gray-400" dir="ltr">{it.sku}</div></td>
                        <td>{it.quantity}</td>
                        <td className="text-xs">
                          {links.length === 0 ? <span className="text-gray-400">غير مربوط</span> : links.map((l) => (
                            <div key={l.id}>
                              {l.supplier.name}: {Number(l.price)} {l.currency} {l.available ? "" : <span className="text-red-600">(غير متوفر)</span>}
                              {l.url && <> · <a href={l.url} target="_blank" className="text-brand-700">الرابط ↗</a></>}
                            </div>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
