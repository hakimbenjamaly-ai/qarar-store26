"use server";

import { revalidatePath } from "next/cache";
import type { DeliveryStatus } from "@prisma/client";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { csvObjects } from "@/lib/csv";
import { DeliveryError, importDeliveryCsv, updateDelivery, type ImportResult } from "@/lib/delivery";
import { flashRedirect, num, str } from "@/lib/action-utils";

async function partnerUser(): Promise<CurrentUser & { deliveryPartnerId: string }> {
  const u = await requireUser("delivery.partner");
  if (!u.deliveryPartnerId) flashRedirect("/admin/partner", { err: "حسابك غير مربوط بشركة توزيع. راجع إدارة المتجر" });
  return u as CurrentUser & { deliveryPartnerId: string };
}

export async function partnerUpdate(fd: FormData) {
  const u = await partnerUser();
  const id = str(fd, "id");
  const back = str(fd, "back") || "/admin/partner";
  try {
    await updateDelivery(
      id,
      { status: (str(fd, "to") as DeliveryStatus) || null, collected: str(fd, "collected") === "" ? null : num(fd, "collected"), reason: str(fd, "reason"), waybillNo: str(fd, "waybillNo"), courierName: str(fd, "courierName") },
      { userId: u.id, source: "partner", partnerId: u.deliveryPartnerId },
    );
    await audit(u.id, "partner_update", "Delivery", id, undefined, { to: str(fd, "to"), collected: str(fd, "collected"), reason: str(fd, "reason") });
  } catch (e) {
    if (e instanceof DeliveryError) flashRedirect(back, { err: e.message });
    throw e;
  }
  revalidatePath("/admin/partner");
  flashRedirect(back, { ok: "تم التحديث" });
}

export async function partnerImport(_prev: ImportResult[] | { error: string } | null, fd: FormData): Promise<ImportResult[] | { error: string }> {
  const u = await partnerUser();
  const file = fd.get("file") as File | null;
  if (!file || file.size === 0) return { error: "اختر ملف CSV" };
  if (file.size > 2_000_000) return { error: "الملف أكبر من 2 ميغابايت" };
  const rows = csvObjects(await file.text());
  if (rows.length === 0) return { error: "الملف فارغ" };
  const res = await importDeliveryCsv(rows, { userId: u.id, source: "partner", partnerId: u.deliveryPartnerId });
  await audit(u.id, "partner_import", "Delivery", file.name, undefined, { rows: res.length, ok: res.filter((r) => r.ok).length });
  revalidatePath("/admin/partner");
  return res;
}
