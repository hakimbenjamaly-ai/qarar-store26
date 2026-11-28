import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateOnly, lyd } from "@/lib/format";
import { parseRange } from "@/lib/reports";
import { Empty, Flash, PageHeader, Stat } from "@/components/admin/ui";
import { Submit } from "@/components/admin/submit";
import { addExpense, deleteExpense } from "./actions";

const CATEGORIES = ["إيجار", "رواتب", "إعلانات وتسويق", "كهرباء وإنترنت", "تغليف ومستلزمات", "عمولات تحويل", "صيانة", "أخرى"];

export default async function Expenses({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; from?: string; to?: string }> }) {
  await requireUser("payments.manage");
  const sp = await searchParams;
  const { f, t } = parseRange(sp.from, sp.to);
  const rows = await db.expense.findMany({ where: { date: { gte: f, lte: t } }, orderBy: { date: "desc" } });
  const total = rows.reduce((s, e) => s + Number(e.amount), 0);
  const today = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);
  return (
    <div>
      <PageHeader title="المصروفات التشغيلية" actions={<Link href="/admin/reports?type=profit" className="btn-outline">تقرير صافي الربح</Link>} />
      <Flash ok={sp.ok} err={sp.err} />
      <p className="mb-4 text-sm text-gray-600">المصروفات العامة غير المرتبطة بطلب معيّن (إيجار، رواتب، إعلانات...). تكاليف البضاعة والشحن الدولي وأجور النورس تُحسب تلقائياً من وحداتها ولا تُدخل هنا.</p>
      <form action={addExpense} className="card mb-5 grid gap-2 p-4 text-sm md:grid-cols-[150px_170px_150px_120px_1fr_auto_auto]">
        <input name="date" type="date" defaultValue={today} className="input" aria-label="التاريخ" />
        <select name="category" required className="input" aria-label="البند">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <input name="otherCategory" placeholder="بند آخر (عند اختيار أخرى)" className="input" aria-label="بند آخر" />
        <input name="amount" required inputMode="decimal" placeholder="المبلغ د.ل" className="input" aria-label="المبلغ" />
        <input name="note" placeholder="ملاحظة" className="input" aria-label="ملاحظة" />
        <input name="receipt" type="file" accept="image/*,application/pdf" className="text-xs" aria-label="الإيصال" />
        <Submit>إضافة</Submit>
      </form>
      <form className="mb-4 flex flex-wrap items-end gap-2 text-sm">
        <div><label className="label">من</label><input type="date" name="from" defaultValue={sp.from ?? new Date(f.getTime() + 2 * 3600e3).toISOString().slice(0, 10)} className="input" /></div>
        <div><label className="label">إلى</label><input type="date" name="to" defaultValue={sp.to ?? today} className="input" /></div>
        <button className="btn-outline">عرض</button>
      </form>
      <div className="mb-4 grid gap-3 sm:grid-cols-2"><Stat label="إجمالي مصروفات الفترة" value={lyd(total)} /><Stat label="عدد القيود" value={rows.length} /></div>
      {rows.length === 0 ? <Empty>لا توجد مصروفات في هذه الفترة.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>التاريخ</th><th>البند</th><th>المبلغ</th><th>ملاحظة</th><th>الإيصال</th><th></th></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>{dateOnly(e.date)}</td>
                  <td>{e.category}</td>
                  <td>{lyd(e.amount)}</td>
                  <td>{e.note}</td>
                  <td>{e.receiptUrl ? <a href={e.receiptUrl} target="_blank" className="text-brand-700 underline">عرض</a> : "—"}</td>
                  <td><form action={deleteExpense}><input type="hidden" name="id" value={e.id} /><Submit className="text-xs text-red-600" confirm="اضغط مرة أخرى للحذف">حذف</Submit></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
