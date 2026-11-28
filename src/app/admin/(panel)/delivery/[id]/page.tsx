import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, lyd } from "@/lib/format";
import { DELIVERY_STATUS_LABELS, deliveryNext, deliveryTone } from "@/lib/delivery";
import { STATUS_LABELS } from "@/lib/order-status";
import { Field, Flash, PageHeader } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { Attachments } from "@/components/admin/attachments";
import { saveDelivery, setDeliveryStatus } from "../actions";

const SOURCE = { admin: "الإدارة", partner: "بوابة النورس", import: "ملف النورس" } as Record<string, string>;

export default async function DeliveryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser("delivery.manage");
  const { id } = await params;
  const d = await db.delivery.findUnique({
    where: { id },
    include: {
      order: true,
      partner: { include: { points: { where: { active: true } } } },
      handover: true,
      settlement: true,
      items: { include: { orderItem: true } },
      events: { orderBy: { createdAt: "desc" } },
      returns: true,
    },
  });
  if (!d) notFound();
  const users = await db.user.findMany({ where: { id: { in: d.events.map((e) => e.userId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const next = deliveryNext(d.status);
  const back = `/admin/delivery/${d.id}`;
  const locked = !!d.settlementId;

  return (
    <div className="space-y-5">
      <PageHeader title={`توصيلة ${d.number}`} back="/admin/delivery/list" actions={<a href={`/admin/delivery/labels?id=${d.id}`} target="_blank" className="btn-outline">طباعة الملصق</a>} />
      <Flash {...await searchParams} />

      <section className="card flex flex-wrap items-center gap-3 p-4 text-sm">
        <span className={`badge ${deliveryTone(d.status)}`}>{DELIVERY_STATUS_LABELS[d.status]}</span>
        <span>الطلب <Link href={`/admin/orders/${d.orderId}`} className="text-brand-700" dir="ltr">{d.order.number}</Link></span>
        <span>{d.partner.name}</span>
        {d.handover && <span>الدفعة <Link href={`/admin/delivery/handovers/${d.handoverId}`} className="text-brand-700" dir="ltr">{d.handover.number}</Link></span>}
        {d.settlement && <span>التسوية <Link href={`/admin/delivery/settlements/${d.settlementId}`} className="text-brand-700" dir="ltr">{d.settlement.number}</Link></span>}
        <span>المحاولات: {d.attempts}</span>
        {d.deliveredAt && <span>سُلّم: {dateTime(d.deliveredAt)}</span>}
      </section>

      {d.status === "READY" && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">الطرد جاهز. يُسلَّم للنورس ضمن «دفعة تسليم» من <Link href="/admin/delivery/list?status=READY" className="underline">التوصيلات الجاهزة</Link>.</p>}

      {next.length > 0 && (
        <form action={setDeliveryStatus} className="card grid gap-3 p-4 text-sm md:grid-cols-[200px_160px_1fr_auto]">
          <input type="hidden" name="id" value={d.id} />
          <input type="hidden" name="back" value={back} />
          <select name="to" required defaultValue="" className="input" aria-label="الحالة الجديدة">
            <option value="" disabled>تغيير الحالة إلى...</option>
            {next.map((s) => <option key={s} value={s}>{DELIVERY_STATUS_LABELS[s]}</option>)}
          </select>
          <input name="collected" inputMode="decimal" placeholder={`المحصّل (${Number(d.codAmount)})`} className="input" aria-label="المبلغ المحصل" title="عند «تم التسليم»: يُفترض المبلغ المطلوب إن تُرك فارغاً" />
          <input name="reason" placeholder="سبب التعذر / ملاحظة" className="input" aria-label="السبب" />
          <Submit>تحديث</Submit>
          {next.includes("RETURNED") && <label className="flex items-center gap-1 md:col-span-4"><input type="checkbox" name="restock" /> عند «عاد إلى المتجر»: أعد الكميات إلى المخزون المحلي (إذا كانت سليمة)</label>}
        </form>
      )}
      {d.status === "DELIVERED" && !locked && (
        <form action={setDeliveryStatus} className="card flex flex-wrap items-center gap-2 p-4 text-sm">
          <input type="hidden" name="id" value={d.id} />
          <input type="hidden" name="back" value={back} />
          <span>تصحيح المبلغ المحصّل قبل التسوية:</span>
          <input name="collected" defaultValue={Number(d.collected ?? 0)} inputMode="decimal" className="input w-32" aria-label="المبلغ المحصل" />
          <Submit className="btn-outline">حفظ</Submit>
        </form>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="card overflow-x-auto">
          <h2 className="p-4 pb-2 font-bold">المحتوى</h2>
          <table className="table">
            <thead><tr><th>المنتج</th><th>الكمية</th><th>حالة البند</th></tr></thead>
            <tbody>
              {d.items.map((i) => (
                <tr key={i.id}><td>{i.orderItem.productName} <span className="text-xs text-gray-500">{i.orderItem.variantName}</span></td><td>{i.quantity}</td><td>{STATUS_LABELS[i.orderItem.status]}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="space-y-1 p-4 text-sm">
            <div><b>{d.order.shipName}</b> · <span dir="ltr">{d.order.shipPhone}</span>{d.order.shipWhatsapp && <> · واتساب <span dir="ltr">{d.order.shipWhatsapp}</span></>}</div>
            <div>{d.order.shipCity} {d.order.shipRegion} – {d.order.shipAddress} {d.order.shipLandmark && `(قرب ${d.order.shipLandmark})`}</div>
            {d.failureReason && <div className="text-red-700">آخر سبب تعذر: {d.failureReason}</div>}
            {d.returns.length > 0 && <div>مرتجع: {d.returns.map((r) => `${r.quantity} قطعة${r.restocked ? " (أُعيدت للمخزون)" : ""}`).join("، ")}</div>}
          </div>
        </section>

        <form action={saveDelivery} className="card space-y-3 p-4 text-sm">
          <input type="hidden" name="id" value={d.id} />
          <h2 className="font-bold">بيانات التوصيل</h2>
          <Field label="رقم البوليصة لدى النورس"><input name="waybillNo" defaultValue={d.waybillNo} dir="ltr" className="input" /></Field>
          <Field label="اسم المندوب"><input name="courierName" defaultValue={d.courierName} className="input" /></Field>
          <Field label="نقطة التوزيع"><select name="pointId" defaultValue={d.pointId ?? ""} className="input"><option value="">—</option>{d.partner.points.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.city})</option>)}</select></Field>
          <Field label="المبلغ المطلوب تحصيله (د.ل)" hint={locked || ["DELIVERED", "RETURNED", "CANCELLED"].includes(d.status) ? "مقفل" : "يُحسب من المتبقي على الطلب عند التجهيز"}>
            <input name="codAmount" defaultValue={Number(d.codAmount)} inputMode="decimal" className="input" disabled={locked || ["DELIVERED", "RETURNED", "CANCELLED"].includes(d.status)} />
          </Field>
          <Field label="أجرة النورس (د.ل)" hint={locked ? "مقفل بعد التسوية" : undefined}><input name="fee" defaultValue={Number(d.fee)} inputMode="decimal" className="input" disabled={locked} /></Field>
          {d.collected !== null && <p>المحصّل: <b>{lyd(d.collected)}</b>{locked ? " (مُسوّى)" : " – لدى النورس بانتظار التسوية"}</p>}
          <Submit>حفظ</Submit>
        </form>
      </div>

      <section className="card p-4 text-sm">
        <h2 className="mb-3 font-bold">سجل التوصيلة</h2>
        <ul className="space-y-2">
          {d.events.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-3 border-b pb-2">
              <span className="text-gray-500">{dateTime(e.createdAt)}</span>
              <b>{DELIVERY_STATUS_LABELS[e.status]}</b>
              {e.note && <span>{e.note}</span>}
              <span className="text-xs text-gray-400">{SOURCE[e.source] ?? e.source}{e.userId && ` · ${users.find((x) => x.id === e.userId)?.name ?? ""}`}</span>
            </li>
          ))}
        </ul>
      </section>

      <Attachments entity="Delivery" entityId={d.id} back={back} canEdit />
    </div>
  );
}
