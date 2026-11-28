import Link from "next/link";
import { requireUser, can } from "@/lib/auth";
import { buildReport, parseRange, REPORTS, type ColType } from "@/lib/reports";
import { dateOnly, lyd } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/ui";
import { PrintButton } from "../orders/[id]/invoice/print-button";

const show = (v: unknown, type?: ColType) => {
  if (v === null || v === undefined || v === "") return "—";
  if (v instanceof Date) return dateOnly(v);
  if (type === "money") return lyd(v as number);
  if (type === "pct") return `${(v as number).toLocaleString("ar-LY", { maximumFractionDigits: 2 })}٪`;
  if (type === "int") return (v as number).toLocaleString("ar-LY", { maximumFractionDigits: 2 });
  return String(v);
};

export default async function Reports({ searchParams }: { searchParams: Promise<{ type?: string; from?: string; to?: string }> }) {
  const u = await requireUser("reports.view");
  const sp = await searchParams;
  const allowed = REPORTS.filter((r) => !r.costs || can(u, "costs.view"));
  const key = allowed.some((r) => r.key === sp.type) ? sp.type! : allowed[0].key;
  const { f, t } = parseRange(sp.from, sp.to);
  const fromStr = sp.from ?? new Date(f.getTime() + 2 * 3600e3).toISOString().slice(0, 10);
  const toStr = sp.to ?? new Date(t.getTime() + 2 * 3600e3).toISOString().slice(0, 10);
  const [r, s] = await Promise.all([buildReport(key, f, t), getSettings()]);
  if (!r) return null;
  const q = (k: string) => `?${new URLSearchParams({ type: k, from: fromStr, to: toStr })}`;
  return (
    <div>
      <div className="no-print">
        <PageHeader title="التقارير" actions={<><a href={`/admin/reports/export${q(key)}`} className="btn-outline">تنزيل Excel</a><PrintButton /></>} />
        <nav className="mb-4 flex gap-1 overflow-x-auto border-b text-sm">
          {allowed.map((x) => (
            <Link key={x.key} href={q(x.key)} className={`shrink-0 border-b-2 px-3 py-2 ${x.key === key ? "border-brand-600 font-semibold text-brand-700" : "border-transparent text-gray-600"}`}>{x.title}</Link>
          ))}
        </nav>
        <form className="card mb-5 flex flex-wrap items-end gap-3 p-4 text-sm">
          <input type="hidden" name="type" value={key} />
          <div><label className="label">من</label><input type="date" name="from" defaultValue={fromStr} className="input" /></div>
          <div><label className="label">إلى</label><input type="date" name="to" defaultValue={toStr} className="input" /></div>
          <button className="btn-primary">عرض</button>
        </form>
      </div>
      <div className="bg-white p-4 print:p-0">
        <div className="mb-4 flex items-end justify-between border-b pb-3">
          <div><div className="text-xl font-bold">{r.title}</div><div className="text-sm text-gray-600">{key === "receivables" ? "الوضع الحالي" : `من ${fromStr} إلى ${toStr}`}</div></div>
          <div className="text-sm font-bold">{s.storeName}</div>
        </div>
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
          {r.summary.map((x) => (
            <div key={x.label} className="rounded-lg border p-3">
              <div className="text-xs text-gray-500">{x.label}</div>
              <div className={`mt-1 text-lg font-bold ${x.tone ?? ""}`}>{show(x.value, x.type)}</div>
            </div>
          ))}
        </div>
        {r.sections.map((sec) => (
          <section key={sec.title} className="mb-6 break-inside-avoid">
            <h2 className="mb-2 font-bold">{sec.title}</h2>
            {sec.note && <p className="mb-2 text-xs text-gray-500">{sec.note}</p>}
            {sec.rows.length === 0 ? <p className="text-sm text-gray-500">لا توجد بيانات في هذه الفترة.</p> : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="table">
                  <thead><tr>{sec.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
                  <tbody>
                    {sec.rows.map((row, i) => <tr key={i}>{sec.columns.map((c) => <td key={c.key}>{show(row[c.key], c.type)}</td>)}</tr>)}
                    {sec.totals && <tr className="bg-gray-50 font-bold">{sec.columns.map((c) => <td key={c.key}>{sec.totals![c.key] === undefined ? "" : show(sec.totals![c.key], c.type)}</td>)}</tr>}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
