import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime, lyd } from "@/lib/format";
import { STATUS_LABELS, statusTone } from "@/lib/order-status";
import { Field, Flash, PageHeader } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { updateCustomer } from "../actions";

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const u = await requireUser("customers.view");
  const c = await db.customer.findUnique({
    where: { id: (await params).id },
    include: { orders: { orderBy: { createdAt: "desc" } }, addresses: { orderBy: { createdAt: "desc" }, include: { city: true } } },
  });
  if (!c) notFound();
  const manage = can(u, "customers.manage");
  const total = c.orders.filter((o) => !["CANCELLED", "RETURNED"].includes(o.status)).reduce((s, o) => s + Number(o.total), 0);
  return (
    <div>
      <PageHeader title={c.fullName} back="/admin/customers" />
      <Flash {...await searchParams} />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="card p-4"><div className="text-sm text-gray-500">عدد الطلبات</div><div className="text-2xl font-bold">{c.orders.length}</div></div>
            <div className="card p-4"><div className="text-sm text-gray-500">إجمالي المشتريات</div><div className="text-2xl font-bold">{lyd(total)}</div></div>
          </div>
          <section className="card overflow-x-auto">
            <h2 className="p-4 pb-2 font-bold">سجل الطلبات</h2>
            <table className="table">
              <tbody>
                {c.orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/admin/orders/${o.id}`} className="text-brand-700" dir="ltr">{o.number}</Link></td>
                    <td>{dateTime(o.createdAt)}</td>
                    <td>{lyd(o.total)}</td>
                    <td><span className={`badge ${statusTone(o.status)}`}>{STATUS_LABELS[o.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="card p-4 text-sm">
            <h2 className="mb-2 font-bold">العناوين المستخدمة</h2>
            <ul className="space-y-1">
              {c.addresses.map((a) => <li key={a.id}>{a.city.name}{a.region ? ` – ${a.region}` : ""} · {a.details}{a.landmark ? ` (قرب ${a.landmark})` : ""}</li>)}
            </ul>
          </section>
        </div>
        <form action={updateCustomer} className="card h-fit space-y-3 p-4 text-sm">
          <input type="hidden" name="id" value={c.id} />
          <fieldset disabled={!manage} className="space-y-3">
            <Field label="الاسم الكامل"><input name="fullName" defaultValue={c.fullName} className="input" /></Field>
            <Field label="الهاتف"><input name="phone" defaultValue={c.phone} dir="ltr" className="input" /></Field>
            <Field label="واتساب"><input name="whatsapp" defaultValue={c.whatsapp ?? ""} dir="ltr" className="input" /></Field>
            <Field label="ملاحظات"><textarea name="notes" defaultValue={c.notes} rows={4} className="input" /></Field>
            {manage && <Submit>حفظ</Submit>}
          </fieldset>
        </form>
      </div>
    </div>
  );
}
