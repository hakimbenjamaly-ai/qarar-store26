import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Flash, PageHeader } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { saveCarrier } from "../actions";

export default async function CarriersPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser("shipping.manage");
  const rows = await db.carrier.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { shipments: true } } } });
  type C = (typeof rows)[number];
  const Row = ({ c }: { c?: C }) => (
    <form action={saveCarrier} className="grid items-center gap-2 p-3 text-sm md:grid-cols-[200px_1fr_auto_auto]">
      {c && <input type="hidden" name="id" value={c.id} />}
      <input name="name" defaultValue={c?.name} required placeholder="اسم الشركة (DHL، Aramex، وكيل شحن...)" className="input" />
      <input name="trackingUrl" defaultValue={c?.trackingUrl} placeholder="رابط صفحة التتبع مع {tracking}" dir="ltr" className="input" />
      <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} /> نشطة</label>
      <Submit className="btn-outline py-1">{c ? "حفظ" : "إضافة"}</Submit>
    </form>
  );
  return (
    <div>
      <PageHeader title="شركات الشحن الدولي" back="/admin/shipments" />
      <p className="mb-4 text-sm text-gray-600">الربط يدوي: زر «تتبع» في الشحنة يفتح صفحة التتبع الرسمية للشركة برقم الشحنة إذا أدخلت رابطها هنا، مثل <span dir="ltr">https://example.com/track?id={"{tracking}"}</span>. الربط الآلي (API) يُضاف بعد التعاقد واستلام بيانات الربط من الشركة.</p>
      <Flash {...await searchParams} />
      <div className="card mb-4"><Row /></div>
      <div className="card divide-y">
        {rows.map((c) => <div key={c.id}><Row c={c} /><div className="px-3 pb-2 text-xs text-gray-400">{c._count.shipments} شحنة</div></div>)}
        {rows.length === 0 && <p className="p-4 text-sm text-gray-500">لم تُضف شركات بعد.</p>}
      </div>
    </div>
  );
}
