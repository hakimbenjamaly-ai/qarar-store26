import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, lyd } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "./print-button";

export default async function Invoice({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("orders.view");
  const [o, s] = await Promise.all([
    db.order.findUnique({ where: { id: (await params).id }, include: { items: true, payments: true, paymentMethod: true } }),
    getSettings(),
  ]);
  if (!o) notFound();
  const paid = o.payments.reduce((t, p) => t + (p.kind === "REFUND" ? -1 : 1) * Number(p.amount), 0);
  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-sm">
      <div className="no-print mb-4"><PrintButton /></div>
      <div className="flex items-start justify-between border-b pb-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {s.logoUrl ? <img src={s.logoUrl} alt="" className="h-14" /> : <div className="text-2xl font-bold">{s.storeName}</div>}
          <div className="mt-1 text-gray-600">{[s.phone, s.address].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="text-left">
          <div className="text-lg font-bold">فاتورة</div>
          <div dir="ltr">{o.number}</div>
          <div>{dateTime(o.createdAt)}</div>
        </div>
      </div>
      <div className="my-4 grid grid-cols-2 gap-4">
        <div>
          <div className="font-bold">العميل</div>
          <div>{o.shipName}</div>
          <div dir="ltr" className="text-right">{o.shipPhone}</div>
          <div>{o.shipCity}{o.shipRegion ? ` – ${o.shipRegion}` : ""}</div>
          <div>{o.shipAddress}</div>
          {o.shipLandmark && <div>قرب: {o.shipLandmark}</div>}
        </div>
        <div>
          <div className="font-bold">الدفع</div>
          <div>{o.paymentMethod?.name ?? "—"}</div>
          <div>المدفوع: {lyd(paid)}</div>
          <div className="font-bold">المتبقي للتحصيل: {lyd(Number(o.total) - paid)}</div>
        </div>
      </div>
      <table className="table border">
        <thead><tr><th>المنتج</th><th>SKU</th><th>الكمية</th><th>السعر</th><th>المجموع</th></tr></thead>
        <tbody>
          {o.items.filter((i) => i.status !== "CANCELLED").map((i) => (
            <tr key={i.id}><td>{i.productName}{i.variantName ? ` (${i.variantName})` : ""}</td><td dir="ltr">{i.sku}</td><td>{i.quantity}</td><td>{lyd(i.unitPrice)}</td><td>{lyd(Number(i.unitPrice) * i.quantity)}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="mr-auto mt-4 w-64 space-y-1">
        <div className="flex justify-between"><span>المجموع</span><span>{lyd(o.subtotal)}</span></div>
        {Number(o.discount) > 0 && <div className="flex justify-between"><span>الخصم</span><span>-{lyd(o.discount)}</span></div>}
        <div className="flex justify-between"><span>التوصيل</span><span>{lyd(o.deliveryFee)}</span></div>
        <div className="flex justify-between border-t pt-1 text-base font-bold"><span>الإجمالي</span><span>{lyd(o.total)}</span></div>
      </div>
    </div>
  );
}
