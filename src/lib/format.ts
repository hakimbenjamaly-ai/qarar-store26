import { Prisma } from "@prisma/client";

type Num = number | string | Prisma.Decimal | null | undefined;

export function toNum(v: Num): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v.toString());
}

export function lyd(v: Num): string {
  return `${toNum(v).toLocaleString("ar-LY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} د.ل`;
}

export function dateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("ar-LY", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Tripoli" });
}

export function dateOnly(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-LY", { dateStyle: "medium", timeZone: "Africa/Tripoli" });
}

/** يوحّد أرقام الهاتف الليبية إلى صيغة 09XXXXXXXX، ويقبل الأرقام العربية و +218 */
export function normalizePhone(input: string): string | null {
  const ar = "٠١٢٣٤٥٦٧٨٩";
  let s = input.replace(/[٠-٩]/g, (c) => String(ar.indexOf(c))).replace(/[^\d+]/g, "");
  if (s.startsWith("+218")) s = "0" + s.slice(4);
  else if (s.startsWith("00218")) s = "0" + s.slice(5);
  else if (s.startsWith("218") && s.length === 12) s = "0" + s.slice(3);
  if (/^9\d{8}$/.test(s)) s = "0" + s;
  return /^09\d{8}$/.test(s) ? s : null;
}

export function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
