import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { Flash, PageHeader } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { saveSupplier } from "./actions";

type S = Awaited<ReturnType<typeof db.supplier.findMany>>[number];

function SupplierForm({ s }: { s?: S }) {
  return (
    <form action={saveSupplier} className="grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
      {s && <input type="hidden" name="id" value={s.id} />}
      <input name="name" defaultValue={s?.name} required placeholder="اسم المورد *" className="input" />
      <input name="platform" defaultValue={s?.platform} placeholder="المنصة (Alibaba، AliExpress، وسيط 1688...)" className="input" />
      <input name="contactName" defaultValue={s?.contactName} placeholder="اسم جهة الاتصال" className="input" />
      <input name="phone" defaultValue={s?.phone} placeholder="الهاتف / واتساب" dir="ltr" className="input" />
      <input name="email" defaultValue={s?.email} placeholder="البريد" dir="ltr" className="input" />
      <input name="website" defaultValue={s?.website} placeholder="الموقع / رابط المتجر" dir="ltr" className="input" />
      <input name="currency" defaultValue={s?.currency ?? "USD"} placeholder="العملة" dir="ltr" className="input" />
      <select name="integrationMode" defaultValue={s?.integrationMode ?? "MANUAL"} className="input">
        <option value="MANUAL">ربط يدوي</option>
        <option value="FILE">ملفات Excel/CSV</option>
        <option value="API" disabled>API (بعد التحقق والتعاقد)</option>
      </select>
      <input name="notes" defaultValue={s?.notes} placeholder="ملاحظات" className="input sm:col-span-2" />
      <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={s?.active ?? true} /> نشط</label>
      <Submit>{s ? "حفظ" : "إضافة"}</Submit>
    </form>
  );
}

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const u = await requireUser();
  if (!can(u, "purchasing.manage") && !can(u, "costs.view")) redirect("/admin?denied=1");
  const rows = await db.supplier.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { costs: true } } } });
  return (
    <div>
      <PageHeader title="الموردون" />
      <p className="mb-4 text-sm text-gray-600">بيانات الموردين الأساسية لربطها بالمنتجات. أوامر الشراء ومتابعة التوفر تأتي في المرحلة ٢.</p>
      <Flash {...await searchParams} />
      <div className="card mb-6 p-4"><h2 className="mb-3 font-bold">إضافة مورد</h2><SupplierForm /></div>
      <div className="card divide-y">
        {rows.map((s) => (
          <details key={s.id} className="p-3">
            <summary className="cursor-pointer text-sm">
              <span className="font-medium">{s.name}</span> {s.platform && <span className="text-gray-500">· {s.platform}</span>} <span className="text-gray-500">· {s._count.costs} خيار منتج</span> {!s.active && <span className="badge bg-gray-200">موقوف</span>}
            </summary>
            <div className="mt-3"><SupplierForm s={s} /></div>
          </details>
        ))}
        {rows.length === 0 && <p className="p-4 text-sm text-gray-500">لا يوجد موردون بعد.</p>}
      </div>
    </div>
  );
}
