"use client";

import { useActionState } from "react";
import type { ImportResult } from "@/lib/delivery";

type State = ImportResult[] | { error: string } | null;

export function ImportForm({ action }: { action: (prev: State, fd: FormData) => Promise<State> }) {
  const [state, run, pending] = useActionState(action, null);
  const rows = Array.isArray(state) ? state : null;
  return (
    <div className="space-y-4">
      <form action={run} className="card flex flex-wrap items-center gap-2 p-4 text-sm">
        <input type="file" name="file" accept=".csv,text/csv" required className="text-sm" aria-label="ملف CSV" />
        <button disabled={pending} className="btn-primary">{pending ? "جارٍ الاستيراد..." : "استيراد وتطبيق"}</button>
      </form>
      {state && !Array.isArray(state) && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      {rows && (
        <div className="card overflow-x-auto">
          <p className="p-4 text-sm">
            <b className="text-emerald-700">{rows.filter((r) => r.ok).length} صف نجح</b> · <b className="text-red-700">{rows.filter((r) => !r.ok).length} صف لم يُطبَّق</b>
          </p>
          <table className="table">
            <thead><tr><th>السطر</th><th>التوصيلة</th><th>النتيجة</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.line} className={r.ok ? "" : "bg-red-50"}>
                  <td>{r.line}</td>
                  <td dir="ltr" className="text-right">{r.number || "—"}</td>
                  <td className={r.ok ? "text-emerald-700" : "text-red-700"}>{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
