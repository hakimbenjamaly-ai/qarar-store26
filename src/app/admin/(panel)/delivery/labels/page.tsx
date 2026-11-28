import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lyd } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "../../orders/[id]/invoice/print-button";

/** ملصقات الطرود: تُطبع وتُلصق على كل طرد قبل تسليمه للنورس */
export default async function Labels({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  await requireUser("delivery.manage");
  const raw = (await searchParams).id;
  const ids = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const [ds, s] = await Promise.all([
    db.delivery.findMany({ where: { id: { in: ids } }, orderBy: { number: "asc" }, include: { order: true, partner: true, items: { include: { orderItem: true } } } }),
    getSettings(),
  ]);
  return (
    <div className="bg-white p-4">
      <div className="no-print mb-4 flex items-center gap-3"><PrintButton /><span className="text-sm text-gray-500">{ds.length} ملصق</span></div>
      <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
        {ds.map((d) => (
          <div key={d.id} className="break-inside-avoid rounded border-2 border-black p-3 text-sm">
            <div className="flex items-center justify-between border-b border-black pb-1">
              <b>{s.storeName}</b>
              <span>{d.partner.name}</span>
            </div>
            <div className="mt-2 text-center text-2xl font-bold" dir="ltr">{d.number}</div>
            <div className="text-center text-xs" dir="ltr">طلب {d.order.number}</div>
            <div className="mt-2"><b>{d.order.shipName}</b> · <span dir="ltr">{d.order.shipPhone}</span></div>
            <div>{d.order.shipCity}{d.order.shipRegion && ` – ${d.order.shipRegion}`}</div>
            <div>{d.order.shipAddress}{d.order.shipLandmark && ` (قرب ${d.order.shipLandmark})`}</div>
            <div className="mt-1 text-xs">{d.items.map((i) => `${i.orderItem.productName} × ${i.quantity}`).join(" + ")}</div>
            <div className="mt-2 border-t border-black pt-1 text-lg font-bold">المطلوب تحصيله: {lyd(d.codAmount)}</div>
          </div>
        ))}
      </div>
      {ds.length === 0 && <p className="text-gray-500">لا توجد طرود محددة.</p>}
    </div>
  );
}
