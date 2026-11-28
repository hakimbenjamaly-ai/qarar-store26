"use client";

import { useMemo, useState } from "react";

type Row = { id: string; number: string; order: string; name: string; status: string; date: string; collected: number; fee: number };
const fmt = (n: number) => n.toLocaleString("ar-LY", { maximumFractionDigits: 2 }) + " د.ل";

export function SettleForm({ rows, partnerId, action }: { rows: Row[]; partnerId: string; action: (fd: FormData) => Promise<void> }) {
  const [sel, setSel] = useState<Set<string>>(new Set(rows.map((r) => r.id)));
  const [fees, setFees] = useState("");
  const [net, setNet] = useState("");
  const t = useMemo(() => {
    const picked = rows.filter((r) => sel.has(r.id));
    const collected = picked.reduce((s, r) => s + r.collected, 0);
    const feeSum = picked.reduce((s, r) => s + r.fee, 0);
    const f = fees === "" ? feeSum : Number(fees) || 0;
    return { count: picked.length, collected, feeSum, expected: collected - f };
  }, [rows, sel, fees]);
  const diff = net === "" ? null : (Number(net) || 0) - t.expected;
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="partnerId" value={partnerId} />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th><input type="checkbox" checked={sel.size === rows.length} onChange={(e) => setSel(new Set(e.target.checked ? rows.map((r) => r.id) : []))} aria-label="تحديد الكل" /></th><th>التوصيلة</th><th>الطلب</th><th>العميل</th><th>الحالة</th><th>التاريخ</th><th>المحصّل</th><th>الأجرة</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><input type="checkbox" name="deliveryId" value={r.id} checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`تحديد ${r.number}`} /></td>
                <td dir="ltr" className="text-right">{r.number}</td>
                <td dir="ltr" className="text-right">{r.order}</td>
                <td>{r.name}</td>
                <td>{r.status}</td>
                <td>{r.date}</td>
                <td>{fmt(r.collected)}</td>
                <td>{fmt(r.fee)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card grid gap-3 p-4 text-sm md:grid-cols-2">
        <dl className="space-y-1">
          <div className="flex justify-between"><dt>التوصيلات المحددة</dt><dd>{t.count}</dd></div>
          <div className="flex justify-between"><dt>إجمالي المحصّل من العملاء</dt><dd>{fmt(t.collected)}</dd></div>
          <div className="flex justify-between"><dt>أجور التوصيل المسجلة</dt><dd>{fmt(t.feeSum)}</dd></div>
          <div className="flex justify-between font-bold"><dt>الصافي المتوقع</dt><dd>{fmt(t.expected)}</dd></div>
          {diff !== null && Math.abs(diff) >= 0.01 && <div className={`flex justify-between font-bold ${diff < 0 ? "text-red-700" : "text-amber-700"}`}><dt>الفرق عن المستلم</dt><dd>{fmt(diff)}</dd></div>}
        </dl>
        <div className="grid gap-2">
          <label>الأجور التي خصمتها النورس (د.ل)<input name="feesDeducted" value={fees} onChange={(e) => setFees(e.target.value)} placeholder={String(t.feeSum)} inputMode="decimal" className="input" /></label>
          <label>الصافي المستلم فعلاً (د.ل) *<input name="netReceived" value={net} onChange={(e) => setNet(e.target.value)} required inputMode="decimal" className="input" /></label>
          <label>تاريخ الاستلام<input name="receivedAt" type="date" className="input" /></label>
          <label>رقم التحويل / الإيصال<input name="reference" className="input" /></label>
          <label>ملاحظات (سبب أي فرق)<input name="notes" className="input" /></label>
          <button className="btn-primary" disabled={t.count === 0}>تسجيل التسوية</button>
        </div>
      </div>
    </form>
  );
}
