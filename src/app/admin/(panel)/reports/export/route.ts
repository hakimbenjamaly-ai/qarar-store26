import { getCurrentUser } from "@/lib/auth";
import { buildReport, parseRange, REPORTS } from "@/lib/reports";
import { reportToXlsx } from "@/lib/xlsx";

export async function GET(req: Request) {
  const u = await getCurrentUser();
  const sp = new URL(req.url).searchParams;
  const key = sp.get("type") ?? "";
  const meta = REPORTS.find((r) => r.key === key);
  if (!u || !u.permissions.has("reports.view")) return new Response("غير مصرح", { status: 403 });
  if (!meta) return new Response("تقرير غير معروف", { status: 404 });
  if (meta.costs && !u.permissions.has("costs.view")) return new Response("يتطلب صلاحية رؤية التكاليف", { status: 403 });
  const from = sp.get("from") ?? undefined;
  const to = sp.get("to") ?? undefined;
  const { f, t } = parseRange(from, to);
  const r = (await buildReport(key, f, t))!;
  const period = `الفترة: ${f.toISOString().slice(0, 10)} إلى ${new Date(t.getTime() - 2 * 3600e3).toISOString().slice(0, 10)}`;
  const buf = await reportToXlsx(r, period);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="qarar-${key}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
