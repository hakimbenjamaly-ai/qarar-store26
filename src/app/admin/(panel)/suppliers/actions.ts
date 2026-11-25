"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
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

async function requireSupplierAccess() {
  const u = await requireUser();
  if (!can(u, "purchasing.manage") && !can(u, "costs.view")) flashRedirect("/admin", { err: "لا تملك صلاحية" });
  return u;
}

export async function linkSupplierProduct(fd: FormData) {
  const u = await requireSupplierAccess();
  const supplierId = str(fd, "supplierId");
  const back = `/admin/suppliers/${supplierId}`;
  const sku = str(fd, "sku").toUpperCase();
  const variant = await db.productVariant.findUnique({ where: { sku } });
  if (!variant) flashRedirect(back, { err: `لا يوجد خيار منتج برمز ${sku}` });
  const price = Number(str(fd, "price"));
  if (!(price >= 0)) flashRedirect(back, { err: "السعر غير صحيح" });
  const supplier = await db.supplier.findUnique({ where: { id: supplierId } });
  const data = {
    url: str(fd, "url"),
    price: new Prisma.Decimal(price.toFixed(2)),
    currency: (str(fd, "currency") || supplier?.currency || "USD").toUpperCase(),
    available: true,
    lastCheckedAt: new Date(),
  };
  await db.supplierProduct.upsert({ where: { supplierId_variantId: { supplierId, variantId: variant.id } }, create: { supplierId, variantId: variant.id, ...data }, update: data });
  await audit(u.id, "upsert", "SupplierProduct", `${supplierId}:${variant.id}`, undefined, data);
  flashRedirect(back, { ok: "تم ربط المنتج بالمورد" });
}

export async function updateSupplierProduct(fd: FormData) {
  const u = await requireSupplierAccess();
  const id = str(fd, "id");
  const sp = await db.supplierProduct.findUnique({ where: { id } });
  if (!sp) flashRedirect("/admin/suppliers", { err: "غير موجود" });
  const back = `/admin/suppliers/${sp.supplierId}`;
  const op = str(fd, "op");
  if (op === "delete") {
    await db.supplierProduct.delete({ where: { id } });
  } else {
    const price = Number(str(fd, "price"));
    await db.supplierProduct.update({
      where: { id },
      data: {
        url: str(fd, "url"),
        price: price >= 0 ? new Prisma.Decimal(price.toFixed(2)) : sp.price,
        available: bool(fd, "available"),
        lastCheckedAt: new Date(),
      },
    });
  }
  await audit(u.id, op === "delete" ? "delete" : "update", "SupplierProduct", id, sp);
  flashRedirect(back, { ok: op === "delete" ? "تم فك الربط" : "تم تحديث التوفر والسعر" });
}
