import { db } from "@/lib/db";
import { dateTime, lyd, normalizePhone } from "@/lib/format";
import { STATUS_LABELS, statusTone } from "@/lib/order-status";
import { ReviewForm } from "./review-form";

export const metadata = { title: "متابعة الطلب" };
export const dynamic = "force-dynamic";

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ n?: string; p?: string; new?: string }> }) {
  const sp = await searchParams;
  const number = (sp.n ?? "").trim().toUpperCase();
  const phone = sp.p ? normalizePhone(sp.p) : null;
  const order =
    number && phone
      ? await db.order.findFirst({
          where: { number, shipPhone: phone },
          include: {
            items: { include: { variant: { select: { productId: true, product: { select: { slug: true } } } } } },
            history: { where: { orderItemId: null }, orderBy: { createdAt: "asc" } },
            payments: true,
            paymentMethod: true,
            reviews: { select: { productId: true } },
          },
        })
      : null;

  const paid = order ? order.payments.reduce((s, p) => s + (p.kind === "REFUND" ? -1 : 1) * Number(p.amount), 0) : 0;
  const reviewed = new Set(order?.reviews.map((r) => r.productId));

  return (
    <div className="container-x max-w-3xl py-8">
      <h1 className="mb-6 text-2xl font-bold">متابعة الطلب</h1>
      {sp.new && order && (
        <div className="mb-6 rounded-xl bg-emerald-50 p-5 text-emerald-800">
          <div className="text-lg font-bold">تم استلام طلبك بنجاح</div>
          <p className="mt-1">رقم طلبك <b dir="ltr">{order.number}</b>. احتفظ به لمتابعة الطلب، وسنتواصل معك لتأكيده.</p>
        </div>
      )}
      <form className="card mb-6 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <input name="n" defaultValue={number} required placeholder="رقم الطلب مثل ORD-2026-00001" dir="ltr" className="input text-right" aria-label="رقم الطلب" />
        <input name="p" defaultValue={sp.p ?? ""} required placeholder="رقم الهاتف المستخدم في الطلب" dir="ltr" className="input text-right" aria-label="رقم الهاتف" />
        <button className="btn-primary">بحث</button>
      </form>

      {number && phone && !order && <div className="card p-6 text-center text-gray-600">لم نجد طلباً بهذا الرقم ورقم الهاتف.</div>}
      {number && !phone && sp.p && <div className="card p-6 text-center text-gray-600">رقم الهاتف غير صحيح.</div>}

      {order && (
        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm text-gray-500">طلب رقم</div>
                <div className="text-lg font-bold" dir="ltr">{order.number}</div>
              </div>
              <span className={`badge text-sm ${statusTone(order.status)}`}>{STATUS_LABELS[order.status]}</span>
            </div>
            <ol className="mt-5 space-y-3 border-r-2 border-brand-100 pr-4">
              {order.history.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -right-[23px] top-1.5 h-3 w-3 rounded-full bg-brand-600" />
                  <div className="font-medium">{STATUS_LABELS[h.toStatus]}</div>
                  <div className="text-xs text-gray-500">{dateTime(h.createdAt)}</div>
                </li>
              ))}
            </ol>
          </div>
          <div className="card overflow-hidden">
            <table className="table">
              <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الحالة</th></tr></thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      {i.productName}{i.variantName ? ` (${i.variantName})` : ""}
                      {i.status === "DELIVERED" && !reviewed.has(i.variant.productId) && (
                        <ReviewForm number={order.number} phone={order.shipPhone} productId={i.variant.productId} />
                      )}
                    </td>
                    <td>{i.quantity}</td>
                    <td>{lyd(Number(i.unitPrice) * i.quantity)}</td>
                    <td><span className={`badge ${statusTone(i.status)}`}>{STATUS_LABELS[i.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1 p-4 text-sm">
              <div className="flex justify-between"><span>المجموع</span><span>{lyd(order.subtotal)}</span></div>
              {Number(order.discount) > 0 && <div className="flex justify-between"><span>الخصم</span><span>-{lyd(order.discount)}</span></div>}
              <div className="flex justify-between"><span>التوصيل</span><span>{lyd(order.deliveryFee)}</span></div>
              <div className="flex justify-between font-bold"><span>الإجمالي</span><span>{lyd(order.total)}</span></div>
              {Number(order.depositRequired) > 0 && <div className="flex justify-between"><span>العربون المطلوب</span><span>{lyd(order.depositRequired)}</span></div>}
              <div className="flex justify-between"><span>المدفوع</span><span>{lyd(paid)}</span></div>
              <div className="flex justify-between"><span>المتبقي</span><span>{lyd(Number(order.total) - paid)}</span></div>
              {order.paymentMethod && <div className="flex justify-between text-gray-500"><span>طريقة الدفع</span><span>{order.paymentMethod.name}</span></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
