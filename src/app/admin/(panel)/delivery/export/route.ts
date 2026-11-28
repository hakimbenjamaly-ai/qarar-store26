import type { DeliveryStatus, Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { DELIVERY_CSV_HEADER, DELIVERY_STATUS_LABELS, deliveryCsvRows } from "@/lib/delivery";

/** ملف Excel للتوصيلات: للإدارة حسب الفلاتر، ولموظف النورس توصيلات شركته الجارية فقط */
export async function GET(req: Request) {
  const u = await getCurrentUser();
  if (!u) return new Response("غير مصرح", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const where: Prisma.DeliveryWhereInput = {};
  if (u.permissions.has("delivery.manage")) {
    const st = sp.get("status") ?? "";
    where.status = st in DELIVERY_STATUS_LABELS ? (st as DeliveryStatus) : st === "all" ? undefined : { notIn: ["DELIVERED", "RETURNED", "CANCELLED"] };
    if (sp.get("partner")) where.partnerId = sp.get("partner")!;
    if (sp.get("handover")) {
      where.handoverId = sp.get("handover")!;
      where.status = undefined;
    }
    const q = sp.get("q");
    if (q) where.OR = [{ number: { contains: q, mode: "insensitive" } }, { order: { number: { contains: q, mode: "insensitive" } } }, { order: { shipPhone: { contains: q } } }];
  } else if (u.permissions.has("delivery.partner") && u.deliveryPartnerId) {
    where.partnerId = u.deliveryPartnerId;
    where.status = { in: ["HANDED_OVER", "IN_DISTRIBUTION", "OUT_FOR_DELIVERY", "FAILED"] };
    if (sp.get("handover")) where.handoverId = sp.get("handover")!;
  } else {
    return new Response("غير مصرح", { status: 403 });
  }
  const csv = toCsv(DELIVERY_CSV_HEADER, await deliveryCsvRows(where));
  const name = `deliveries-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
}
