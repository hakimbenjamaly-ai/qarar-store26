import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Flash, PageHeader } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { DeliveryTabs } from "../tabs";
import { savePartner, savePoint } from "../actions";

export default async function Partners({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser("delivery.manage");
  const partners = await db.deliveryPartner.findMany({ orderBy: { name: "asc" }, include: { points: { orderBy: { city: "asc" } }, users: { select: { name: true, email: true } } } });
  type Pt = (typeof partners)[number];
  const PartnerForm = ({ p }: { p?: Pt }) => (
    <form action={savePartner} className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
      {p && <input type="hidden" name="id" value={p.id} />}
      <input name="name" defaultValue={p?.name ?? (partners.length === 0 ? "شركة النورس" : "")} required placeholder="اسم الشركة *" className="input" aria-label="اسم الشركة" />
      <input name="phone" defaultValue={p?.phone} placeholder="الهاتف" dir="ltr" className="input" aria-label="الهاتف" />
      <input name="email" defaultValue={p?.email} placeholder="البريد" dir="ltr" className="input" aria-label="البريد" />
      <input name="address" defaultValue={p?.address} placeholder="العنوان" className="input" aria-label="العنوان" />
      <label className="flex items-center gap-2">أجرة الطرد (د.ل)<input name="defaultFee" defaultValue={p ? Number(p.defaultFee) : ""} inputMode="decimal" className="input w-24" /></label>
      <select name="integrationMode" defaultValue={p?.integrationMode ?? "FILE"} className="input" aria-label="طريقة التبادل">
        <option value="FILE">تبادل ملفات Excel</option>
        <option value="MANUAL">إدخال يدوي فقط</option>
      </select>
      <input name="notes" defaultValue={p?.notes} placeholder="ملاحظات (شروط الاتفاق...)" className="input" aria-label="ملاحظات" />
      <div className="flex items-center gap-3">{p && <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={p.active} /> نشطة</label>}<Submit>{p ? "حفظ" : "إضافة"}</Submit></div>
    </form>
  );
  return (
    <div>
      <PageHeader title="شركة التوزيع ونقاطها" />
      <DeliveryTabs active="/admin/delivery/partners" />
      <Flash {...await searchParams} />
      <p className="mb-4 text-sm text-gray-600">ربط API المباشر مع النورس غير مفعّل لعدم توفر بيانات الربط؛ التبادل يتم بملفات Excel أو بالإدخال اليدوي أو من بوابة موظف النورس. لإعطاء موظف النورس حساباً: أنشئه من «المستخدمون» بدور «موظف شركة النورس» واختر الشركة.</p>
      <div className="space-y-4">
        {partners.map((p) => (
          <div key={p.id} className="card space-y-4 p-4">
            <PartnerForm p={p} />
            <div className="text-xs text-gray-500">حسابات الموظفين: {p.users.length ? p.users.map((u) => u.name).join("، ") : "لا يوجد"}</div>
            <div>
              <h3 className="mb-2 text-sm font-bold">نقاط التوزيع / الفروع</h3>
              <div className="space-y-2">
                {[...p.points, null].map((pt) => (
                  <form key={pt?.id ?? "new"} action={savePoint} className="grid gap-2 text-sm sm:grid-cols-[1fr_140px_1.5fr_140px_auto_auto]">
                    {pt ? <input type="hidden" name="id" value={pt.id} /> : <input type="hidden" name="partnerId" value={p.id} />}
                    <input name="name" defaultValue={pt?.name} required placeholder="اسم النقطة" className="input" aria-label="اسم النقطة" />
                    <input name="city" defaultValue={pt?.city} required placeholder="المدينة" className="input" aria-label="المدينة" />
                    <input name="address" defaultValue={pt?.address} placeholder="العنوان" className="input" aria-label="العنوان" />
                    <input name="phone" defaultValue={pt?.phone} placeholder="الهاتف" dir="ltr" className="input" aria-label="الهاتف" />
                    {pt ? <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={pt.active} /> نشطة</label> : <span />}
                    <Submit className="btn-outline">{pt ? "حفظ" : "+ نقطة"}</Submit>
                  </form>
                ))}
              </div>
            </div>
          </div>
        ))}
        <div className="card p-4"><h2 className="mb-3 font-bold">{partners.length ? "إضافة شركة أخرى" : "إضافة شركة التوزيع"}</h2><PartnerForm /></div>
      </div>
    </div>
  );
}
