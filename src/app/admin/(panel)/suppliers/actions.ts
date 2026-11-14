"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { bool, flashRedirect, str } from "@/lib/action-utils";

const P = "/admin/suppliers";

export async function saveSupplier(fd: FormData) {
  const u = await requireUser();
  if (!can(u, "purchasing.manage") && !can(u, "costs.view")) flashRedirect("/admin", { err: "لا تملك صلاحية" });
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!name) flashRedirect(P, { err: "اسم المورد مطلوب" });
  const mode = str(fd, "integrationMode");
  const data = {
    name,
    platform: str(fd, "platform"),
    contactName: str(fd, "contactName"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    website: str(fd, "website"),
    currency: (str(fd, "currency") || "USD").toUpperCase().slice(0, 5),
    integrationMode: mode === "FILE" || mode === "API" ? mode : "MANUAL",
    notes: str(fd, "notes"),
    active: bool(fd, "active"),
  } as const;
  if (id) {
    const before = await db.supplier.findUnique({ where: { id } });
    await db.supplier.update({ where: { id }, data });
    await audit(u.id, "update", "Supplier", id, before, data);
  } else {
    const s = await db.supplier.create({ data });
    await audit(u.id, "create", "Supplier", s.id, undefined, s);
  }
  revalidatePath(P);
  flashRedirect(P, { ok: "تم حفظ المورد" });
}
