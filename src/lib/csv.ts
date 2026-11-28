// ملفات CSV متوافقة مع Excel (UTF-8 مع BOM حتى تظهر العربية بشكل صحيح)

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(header: string[], rows: unknown[][]) {
  return "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}

/** يقرأ CSV بفاصلة أو فاصلة منقوطة (حسب إعدادات Excel)، مع دعم الحقول بين علامات تنصيص */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += c;
  }
  if (cur !== "" || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** يحوّل الصفوف إلى كائنات بأسماء الأعمدة (بعد تنظيف المسافات) */
export function csvObjects(text: string) {
  const [head, ...rest] = parseCsv(text);
  if (!head) return [];
  const keys = head.map((h) => h.trim());
  return rest.map((r, i) => ({ line: i + 2, get: (...names: string[]) => {
    for (const n of names) {
      const k = keys.indexOf(n);
      if (k >= 0) return (r[k] ?? "").trim();
    }
    return "";
  } }));
}
