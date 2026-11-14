"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { normalizePhone } from "@/lib/format";
import { flashRedirect, str } from "@/lib/action-utils";

export async function updateCustomer(fd: FormData) {
  const u = await requireUser("customers.manage");
  const id = str(fd, "id");
  const back = `/admin/customers/${id}`;
  const before = await db.customer.findUnique({ where: { id } });
  if (!before) flashRedirect("/admin/customers", { err: "العميل غير موجود" });
  const phone = normalizePhone(str(fd, "phone"));
  if (!phone) flashRedirect(back, { err: "رقم الهاتف غير صحيح" });
  const wa = str(fd, "whatsapp");
  const whatsapp = wa ? normalizePhone(wa) : null;
  if (wa && !whatsapp) flashRedirect(back, { err: "رقم الواتساب غير صحيح" });
  if (phone !== before.phone && (await db.customer.findUnique({ where: { phone } }))) flashRedirect(back, { err: "رقم الهاتف مسجل لعميل آخر" });
  const data = { fullName: str(fd, "fullName") || before.fullName, phone, whatsapp, notes: str(fd, "notes") };
  await db.customer.update({ where: { id }, data });
  await audit(u.id, "update", "Customer", id, before, data);
  flashRedirect(back, { ok: "تم الحفظ" });
}
