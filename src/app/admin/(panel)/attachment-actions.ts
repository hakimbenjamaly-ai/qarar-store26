"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { saveUpload } from "@/lib/uploads";
import { flashRedirect, str } from "@/lib/action-utils";
import type { Permission } from "@/lib/permissions";

const ENTITY_PERM: Record<string, Permission> = { PurchaseOrder: "purchasing.manage", Shipment: "shipping.manage" };

export async function uploadAttachment(fd: FormData) {
  const entity = str(fd, "entity");
  const entityId = str(fd, "entityId");
  const back = str(fd, "back");
  const perm = ENTITY_PERM[entity];
  if (!perm) flashRedirect("/admin", { err: "نوع غير معروف" });
  const u = await requireUser(perm);
  const file = fd.get("file") as File | null;
  let url: string | null = null;
  try {
    url = await saveUpload(file, "attachments");
  } catch (e) {
    flashRedirect(back, { err: (e as Error).message });
  }
  if (!url || !file) flashRedirect(back, { err: "اختر ملفاً" });
  const a = await db.attachment.create({ data: { entity, entityId, kind: str(fd, "kind") || "other", name: str(fd, "name") || file.name, url, userId: u.id } });
  await audit(u.id, "create", "Attachment", a.id, undefined, a);
  revalidatePath(back);
  flashRedirect(back, { ok: "تم رفع الملف" });
}

export async function deleteAttachment(fd: FormData) {
  const u = await requireUser();
  const a = await db.attachment.findUnique({ where: { id: str(fd, "id") } });
  const back = str(fd, "back");
  if (!a) flashRedirect(back, { err: "الملف غير موجود" });
  if (!can(u, ENTITY_PERM[a.entity])) flashRedirect(back, { err: "لا تملك صلاحية" });
  await db.attachment.delete({ where: { id: a.id } });
  await audit(u.id, "delete", "Attachment", a.id, a);
  flashRedirect(back, { ok: "تم حذف الملف" });
}
