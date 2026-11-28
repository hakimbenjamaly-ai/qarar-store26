import "server-only";
import ExcelJS from "exceljs";
import type { Report } from "./reports";

/** ملف Excel حقيقي (xlsx) من اتجاه اليمين لليسار، بورقة ملخص وورقة لكل قسم */
export async function reportToXlsx(r: Report, period: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Qarar";
  wb.created = new Date();
  const fmt = (type?: string) => (type === "money" ? "#,##0.00" : type === "pct" ? "0.00\"%\"" : type === "int" ? "#,##0" : type === "date" ? "yyyy-mm-dd" : undefined);

  const sum = wb.addWorksheet("الملخص", { views: [{ rightToLeft: true }] });
  sum.addRow([r.title]).font = { bold: true, size: 14 };
  sum.addRow([period]);
  sum.addRow([]);
  for (const s of r.summary) {
    const row = sum.addRow([s.label, s.value]);
    const nf = fmt(s.type);
    if (nf) row.getCell(2).numFmt = nf;
  }
  sum.getColumn(1).width = 40;
  sum.getColumn(2).width = 20;

  const used = new Set<string>();
  for (const sec of r.sections) {
    let name = sec.title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
    while (used.has(name)) name = name.slice(0, 29) + "_" + used.size;
    used.add(name);
    const ws = wb.addWorksheet(name, { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
    ws.columns = sec.columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(12, c.label.length + 4), style: fmt(c.type) ? { numFmt: fmt(c.type) } : {} }));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6F4" } };
    for (const row of sec.rows) ws.addRow(Object.fromEntries(sec.columns.map((c) => [c.key, row[c.key] ?? null])));
    if (sec.totals) {
      const tr = ws.addRow(Object.fromEntries(sec.columns.map((c) => [c.key, sec.totals![c.key] ?? null])));
      tr.font = { bold: true };
    }
    if (sec.note) ws.addRow([]).getCell(1).value = sec.note;
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
