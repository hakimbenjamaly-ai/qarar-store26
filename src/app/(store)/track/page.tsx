import { db } from "@/lib/db";
import type { Metadata } from "next";
import type { OrderStatus } from "@prisma/client";
import { normalizePhone } from "@/lib/format";
import { STATUS_LABELS, statusTone } from "@/lib/order-status";
import { getDict } from "@/lib/locale";
import { dateTimeL, money, pick, STATUS_LABELS_EN } from "@/lib/i18n";
import { ReviewForm } from "./review-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.trackTitle };
}
export const dynamic = "force-dynamic";

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ n?: string; p?: string; new?: string }> }) {
  const [sp, { l, t }] = await Promise.all([searchParams, getDict()]);
  const label = (st: OrderStatus) => (l === "en" ? STATUS_LABELS_EN[st] : STATUS_LABELS[st]);
  const lyd = (n: unknown) => money(n as number, l);
  const number = (sp.n ?? "").trim().toUpperCase();
  const phone = sp.p ? normalizePhone(sp.p) : null;
  const order =
    number && phone
      ? await db.order.findFirst({
          where: { number, shipPhone: phone },
          include: {
            items: { include: { variant: { select: { productId: true, nameEn: true, product: { select: { slug: true, nameEn: true } } } } } },
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
      <h1 className="mb-6 text-2xl font-bold">{t.trackTitle}</h1>
      {sp.new && order && (
        <div className="mb-6 rounded-xl bg-emerald-50 p-5 text-emerald-800">
          <div className="text-lg font-bold">{t.orderReceived}</div>
          <p className="mt-1">{t.orderReceivedText} <b dir="ltr">{order.number}</b>. {t.orderReceivedKeep}</p>
        </div>
      )}
      <form className="card mb-6 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <input name="n" defaultValue={number} required placeholder={t.orderNumberPh} dir="ltr" className="input rtl:text-right" aria-label={t.orderNumberPh} />
        <input name="p" defaultValue={sp.p ?? ""} required placeholder={t.orderPhonePh} dir="ltr" className="input rtl:text-right" aria-label={t.orderPhonePh} />
        <button className="btn-primary">{t.search}</button>
      </form>

      {number && phone && !order && <div className="card p-6 text-center text-gray-600">{t.orderNotFound}</div>}
      {number && !phone && sp.p && <div className="card p-6 text-center text-gray-600">{t.phoneInvalid}</div>}

      {order && (
        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm text-gray-500">{t.orderNo}</div>
                <div className="text-lg font-bold" dir="ltr">{order.number}</div>
              </div>
              <span className={`badge text-sm ${statusTone(order.status)}`}>{label(order.status)}</span>
            </div>
            <ol className="mt-5 space-y-3 border-s-2 border-brand-100 ps-4">
              {order.history.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -start-[23px] top-1.5 h-3 w-3 rounded-full bg-brand-600" />
                  <div className="font-medium">{label(h.toStatus)}</div>
                  <div className="text-xs text-gray-500">{dateTimeL(h.createdAt, l)}</div>
                </li>
              ))}
            </ol>
          </div>
          <div className="card overflow-hidden">
            <table className="table">
              <thead><tr><th>{t.product}</th><th>{t.quantity}</th><th>{t.price}</th><th>{t.status}</th></tr></thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      {pick(l, i.productName, i.variant.product.nameEn)}{i.variantName ? ` (${pick(l, i.variantName, i.variant.nameEn)})` : ""}
                      {i.status === "DELIVERED" && !reviewed.has(i.variant.productId) && (
                        <ReviewForm number={order.number} phone={order.shipPhone} productId={i.variant.productId} l={l} />
                      )}
                    </td>
                    <td>{i.quantity}</td>
                    <td>{lyd(Number(i.unitPrice) * i.quantity)}</td>
                    <td><span className={`badge ${statusTone(i.status)}`}>{label(i.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1 p-4 text-sm">
              <div className="flex justify-between"><span>{t.subtotal}</span><span>{lyd(order.subtotal)}</span></div>
              {Number(order.discount) > 0 && <div className="flex justify-between"><span>{t.discount}</span><span>−{lyd(order.discount)}</span></div>}
              <div className="flex justify-between"><span>{t.delivery}</span><span>{lyd(order.deliveryFee)}</span></div>
              <div className="flex justify-between font-bold"><span>{t.total}</span><span>{lyd(order.total)}</span></div>
              {Number(order.depositRequired) > 0 && <div className="flex justify-between"><span>{t.depositRequired}</span><span>{lyd(order.depositRequired)}</span></div>}
              <div className="flex justify-between"><span>{t.paid}</span><span>{lyd(paid)}</span></div>
              <div className="flex justify-between"><span>{t.remaining}</span><span>{lyd(Number(order.total) - paid)}</span></div>
              {order.paymentMethod && <div className="flex justify-between text-gray-500"><span>{t.paymentMethod}</span><span>{pick(l, order.paymentMethod.name, order.paymentMethod.nameEn)}</span></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
