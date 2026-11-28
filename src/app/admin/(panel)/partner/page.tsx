import type { DeliveryStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, lyd } from "@/lib/format";
import { DELIVERY_STATUS_LABELS, deliveryNext, deliveryTone } from "@/lib/delivery";
import { Empty, Flash, PageHeader } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { ImportForm } from "@/components/admin/import-form";
import { partnerImport, partnerUpdate } from "./actions";

const ACTIVE: DeliveryStatus[] = ["HANDED_OVER", "IN_DISTRIBUTION", "OUT_FOR_DELIVERY", "FAILED"];

/** بوابة موظف النورس: توصيلات شركته فقط، بدون أي تكاليف أو أرباح داخلية */
export default async function PartnerPortal({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; view?: string; q?: string }> }) {
  const u = await requireUser("delivery.partner");
  const sp = await searchParams;
  if (!u.deliveryPartnerId) {
    return (<div><PageHeader title="بوابة شركة التوزيع" /><p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">حسابك غير مربوط بشركة توزيع. تواصل مع إدارة المتجر.</p></div>);
  }
  const done = sp.view === "done";
  const [partner, rows] = await Promise.all([
    db.deliveryPartner.findUnique({ where: { id: u.deliveryPartnerId } }),
    db.delivery.findMany({
      where: {
        partnerId: u.deliveryPartnerId,
        status: done ? { in: ["DELIVERED", "RETURNED"] } : { in: ACTIVE },
        OR: sp.q ? [{ number: { contains: sp.q, mode: "insensitive" } }, { order: { shipPhone: { contains: sp.q } } }, { waybillNo: { contains: sp.q, mode: "insensitive" } }] : undefined,
      },
      orderBy: done ? { updatedAt: "desc" } : { createdAt: "asc" },
      take: done ? 100 : 500,
      // عمداً: بيانات التوصيل فقط، لا أسعار شراء أو تكاليف
      select: {
        id: true, number: true, status: true, codAmount: true, collected: true, waybillNo: true, courierName: true, failureReason: true, attempts: true, updatedAt: true,
        handover: { select: { number: true } },
        order: { select: { number: true, shipName: true, shipPhone: true, shipWhatsapp: true, shipCity: true, shipRegion: true, shipAddress: true, shipLandmark: true } },
        items: { select: { quantity: true, orderItem: { select: { productName: true, variantName: true } } } },
      },
    }),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader title={`بوابة ${partner?.name ?? "شركة التوزيع"}`} actions={<a href={`/admin/delivery/export?mine=${1}`} className="btn-outline">تنزيل الطرود الجارية (Excel CSV)</a>} />
      <Flash ok={sp.ok} err={sp.err} />
      <form className="flex flex-wrap gap-2 text-sm">
        <select name="view" defaultValue={sp.view ?? ""} className="input w-44" aria-label="العرض"><option value="">الطرود الجارية</option><option value="done">المنتهية (آخر 100)</option></select>
        <input name="q" defaultValue={sp.q} placeholder="رقم التوصيلة أو الهاتف" className="input w-56" />
        <button className="btn-outline">عرض</button>
      </form>
      {rows.length === 0 ? <Empty>لا توجد طرود.</Empty> : (
        <div className="space-y-3">
          {rows.map((d) => {
            const next = deliveryNext(d.status, "partner");
            return (
              <div key={d.id} className="card p-4 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <b dir="ltr">{d.number}</b>
                  <span className={`badge ${deliveryTone(d.status)}`}>{DELIVERY_STATUS_LABELS[d.status]}</span>
                  {d.handover && <span className="text-xs text-gray-500">دفعة <span dir="ltr">{d.handover.number}</span></span>}
                  <span className="text-xs text-gray-500">محاولات: {d.attempts} · {dateTime(d.updatedAt)}</span>
                  <span className="mr-auto text-base font-bold">للتحصيل: {lyd(d.codAmount)}</span>
                </div>
                <div className="mt-2"><b>{d.order.shipName}</b> · <a href={`tel:${d.order.shipPhone}`} dir="ltr" className="text-brand-700">{d.order.shipPhone}</a>{d.order.shipWhatsapp && <> · واتساب <span dir="ltr">{d.order.shipWhatsapp}</span></>}</div>
                <div>{d.order.shipCity} {d.order.shipRegion} – {d.order.shipAddress} {d.order.shipLandmark && `(قرب ${d.order.shipLandmark})`}</div>
                <div className="text-xs text-gray-600">{d.items.map((i) => `${i.orderItem.productName}${i.orderItem.variantName ? ` (${i.orderItem.variantName})` : ""} × ${i.quantity}`).join(" + ")}</div>
                {d.failureReason && <div className="text-xs text-red-700">آخر سبب تعذر: {d.failureReason}</div>}
                {d.collected !== null && <div>المحصّل: {lyd(d.collected)}</div>}
                {next.length > 0 && (
                  <form action={partnerUpdate} className="mt-3 grid gap-2 sm:grid-cols-[170px_120px_1fr_130px_130px_auto]">
                    <input type="hidden" name="id" value={d.id} />
                    <select name="to" defaultValue="" className="input" aria-label="الحالة"><option value="">بدون تغيير الحالة</option>{next.map((s) => <option key={s} value={s}>{DELIVERY_STATUS_LABELS[s]}</option>)}</select>
                    <input name="collected" placeholder="المحصّل" inputMode="decimal" className="input" aria-label="المبلغ المحصل" />
                    <input name="reason" placeholder="سبب التعذر (إلزامي عند التعذر)" className="input" aria-label="سبب التعذر" />
                    <input name="waybillNo" defaultValue={d.waybillNo} placeholder="رقم البوليصة" dir="ltr" className="input" aria-label="رقم البوليصة" />
                    <input name="courierName" defaultValue={d.courierName} placeholder="المندوب" className="input" aria-label="المندوب" />
                    <Submit>حفظ</Submit>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div>
        <h2 className="mb-2 font-bold">تحديث جماعي من ملف</h2>
        <p className="mb-2 text-sm text-gray-600">نزّل ملف الطرود الجارية، عدّل أعمدة الحالة والمبلغ المحصل وسبب التعذر ورقم البوليصة، ثم ارفعه بصيغة CSV.</p>
        <ImportForm action={partnerImport} />
      </div>
    </div>
  );
}
