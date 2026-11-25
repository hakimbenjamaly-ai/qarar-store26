import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { PO_STATUS_LABELS } from "@/lib/purchasing";
import { Flash, PageHeader } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { linkSupplierProduct, updateSupplierProduct } from "../actions";

export default async function SupplierPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const u = await requireUser();
  if (!can(u, "purchasing.manage") && !can(u, "costs.view")) redirect("/admin?denied=1");
  const s = await db.supplier.findUnique({
    where: { id: (await params).id },
    include: {
      products: { orderBy: { lastCheckedAt: "asc" }, include: { variant: { include: { product: { select: { id: true, name: true } } } } } },
      purchaseOrders: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!s) notFound();
  const stale = (d: Date | null) => !d || Date.now() - d.getTime() > 14 * 864e5;
  return (
    <div className="space-y-6">
      <PageHeader title={s.name} back="/admin/suppliers" actions={can(u, "purchasing.manage") ? <Link href={`/admin/purchase-orders/new?supplier=${s.id}`} className="btn-primary">+ أمر شراء للمخزون</Link> : undefined} />
      <Flash {...await searchParams} />
      <div className="card grid gap-2 p-4 text-sm sm:grid-cols-3">
        <div>المنصة: {s.platform || "—"}</div>
        <div>العملة: {s.currency}</div>
        <div>طريقة الربط: {s.integrationMode === "MANUAL" ? "يدوي" : s.integrationMode === "FILE" ? "ملفات" : "API"}</div>
        <div>جهة الاتصال: {s.contactName || "—"}</div>
        <div dir="ltr" className="text-right">{s.phone}</div>
        <div>{s.website && <a href={s.website} target="_blank" className="text-brand-700 underline">الموقع ↗</a>}</div>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="p-4 pb-1 font-bold">منتجات هذا المورد</h2>
        <p className="px-4 text-xs text-gray-500">رابط المنتج لدى المورد وسعره وتوفره. افتح الرابط وتحقق ثم حدّث الحالة؛ يظهر تنبيه لما لم يُراجع منذ أكثر من 14 يوماً.</p>
        <table className="table mt-2">
          <thead><tr><th>المنتج</th><th>السعر</th><th>الرابط</th><th>متوفر</th><th>آخر تحقق</th><th></th></tr></thead>
          <tbody>
            {s.products.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/admin/products/${p.variant.product.id}`} className="hover:text-brand-700">{p.variant.product.name}</Link>
                  <div className="text-xs text-gray-500" dir="ltr">{p.variant.sku} {p.variant.name}</div>
                </td>
                <td colSpan={5}>
                  <form action={updateSupplierProduct} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <input name="price" defaultValue={String(p.price)} className="input w-24" aria-label="السعر" /> <span className="text-xs">{p.currency}</span>
                    <input name="url" defaultValue={p.url} dir="ltr" className="input w-56" aria-label="الرابط" />
                    {p.url && <a href={p.url} target="_blank" className="text-xs text-brand-700">فتح ↗</a>}
                    <label className="flex items-center gap-1"><input type="checkbox" name="available" defaultChecked={p.available} /> متوفر</label>
                    <span className={`text-xs ${stale(p.lastCheckedAt) ? "text-amber-700" : "text-gray-500"}`}>{dateTime(p.lastCheckedAt)}</span>
                    <button name="op" value="save" className="btn-outline py-1">تم التحقق / حفظ</button>
                    <button name="op" value="delete" className="py-1 text-xs text-red-600">فك الربط</button>
                  </form>
                </td>
              </tr>
            ))}
            {s.products.length === 0 && <tr><td colSpan={6} className="text-gray-500">لم تُربط منتجات بهذا المورد بعد.</td></tr>}
          </tbody>
        </table>
        <form action={linkSupplierProduct} className="flex flex-wrap items-end gap-2 border-t p-4 text-sm">
          <input type="hidden" name="supplierId" value={s.id} />
          <input name="sku" required placeholder="SKU خيار المنتج" dir="ltr" className="input w-40" />
          <input name="price" required placeholder="سعر المورد" inputMode="decimal" className="input w-28" />
          <input name="currency" defaultValue={s.currency} dir="ltr" className="input w-20" aria-label="العملة" />
          <input name="url" placeholder="رابط المنتج لدى المورد" dir="ltr" className="input w-72" />
          <Submit>ربط</Submit>
        </form>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="p-4 pb-2 font-bold">أوامر الشراء</h2>
        <table className="table">
          <tbody>
            {s.purchaseOrders.map((po) => (
              <tr key={po.id}>
                <td><Link href={`/admin/purchase-orders/${po.id}`} className="text-brand-700" dir="ltr">{po.number}</Link></td>
                <td>{dateTime(po.createdAt)}</td>
                <td>{Number(po.total)} {po.currency}</td>
                <td>{PO_STATUS_LABELS[po.status]}</td>
              </tr>
            ))}
            {s.purchaseOrders.length === 0 && <tr><td className="text-gray-500">لا توجد أوامر شراء.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
