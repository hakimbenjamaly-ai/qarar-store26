"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { saveUpload } from "@/lib/uploads";
import { slugify } from "@/lib/format";
import { bool, flashRedirect, num, str } from "@/lib/action-utils";

const P = "/admin/categories";

export async function saveCategory(fd: FormData) {
  const u = await requireUser("categories.manage");
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!name) flashRedirect(P, { err: "اسم القسم مطلوب" });
  const slug = slugify(str(fd, "slug") || name);
  const parentId = str(fd, "parentId") || null;
  if (id && parentId === id) flashRedirect(P, { err: "لا يمكن أن يكون القسم فرعياً لنفسه" });
  if (id && parentId) {
    // منع الحلقات: الأب الجديد لا يجوز أن يكون من أحفاد القسم
    let cur: string | null = parentId;
    while (cur) {
      if (cur === id) flashRedirect(P, { err: "لا يمكن نقل القسم تحت أحد أقسامه الفرعية" });
      cur = (await db.category.findUnique({ where: { id: cur }, select: { parentId: true } }))?.parentId ?? null;
    }
  }
  const dup = await db.category.findFirst({ where: { slug, NOT: id ? { id } : undefined } });
  if (dup) flashRedirect(P, { err: "الرابط مستخدم لقسم آخر" });
  let imageUrl: string | null | undefined;
  try {
    imageUrl = await saveUpload(fd.get("image") as File | null, "categories");
  } catch (e) {
    flashRedirect(P, { err: (e as Error).message });
  }
  const data = { name, slug, parentId, sortOrder: num(fd, "sortOrder"), active: bool(fd, "active"), ...(imageUrl ? { imageUrl } : {}) };
  if (bool(fd, "removeImage")) Object.assign(data, { imageUrl: null });
  if (id) {
    const before = await db.category.findUnique({ where: { id } });
    const after = await db.category.update({ where: { id }, data });
    await audit(u.id, "update", "Category", id, before, after);
  } else {
    const c = await db.category.create({ data });
    await audit(u.id, "create", "Category", c.id, undefined, c);
  }
  revalidatePath("/", "layout");
  flashRedirect(P, { ok: "تم حفظ القسم" });
}

export async function deleteCategory(fd: FormData) {
  const u = await requireUser("categories.manage");
  const id = str(fd, "id");
  const c = await db.category.findUnique({ where: { id }, include: { _count: { select: { products: true, children: true } } } });
  if (!c) flashRedirect(P, { err: "القسم غير موجود" });
  if (c._count.products > 0 || c._count.children > 0) flashRedirect(P, { err: "لا يمكن حذف قسم يحتوي على منتجات أو أقسام فرعية. انقلها أولاً أو أوقف القسم." });
  await db.category.delete({ where: { id } });
  await audit(u.id, "delete", "Category", id, c);
  revalidatePath("/", "layout");
  flashRedirect(P, { ok: "تم حذف القسم" });
}
