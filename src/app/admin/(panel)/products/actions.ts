"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { saveUpload } from "@/lib/uploads";
import { slugify } from "@/lib/format";
import { bool, flashRedirect, num, str } from "@/lib/action-utils";

const dec = (s: string) => {
  const v = Number(String(s).replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))));
  return Number.isFinite(v) && v >= 0 ? v : 0;
};

const variantSchema = z.object({
  id: z.string().optional(),
  sku: z.string().trim().max(60),
  name: z.string().trim().max(100),
  nameEn: z.string().trim().max(100).default(""),
  size: z.string().trim().max(50),
  color: z.string().trim().max(50),
  price: z.string(),
  compareAtPrice: z.string(),
  stockQty: z.string(),
  active: z.boolean(),
  cost: z.object({
    purchasePrice: z.string(),
    purchaseCurrency: z.string().trim().toUpperCase().max(5),
    shippingCost: z.string(),
    shippingCurrency: z.string().trim().toUpperCase().max(5),
    otherFeesLyd: z.string(),
    localDeliveryLyd: z.string(),
    marginType: z.enum(["PERCENT", "FIXED"]),
    marginValue: z.string(),
  }),
});

function parseSpecs(text: string) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.search(/[:：]/);
      return i > 0 ? { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() } : { label: l, value: "" };
    });
}

export async function saveProduct(fd: FormData) {
  const u = await requireUser("products.manage");
  const showCosts = can(u, "costs.view");
  const id = str(fd, "id");
  const back = id ? `/admin/products/${id}` : "/admin/products/new";

  const name = str(fd, "name");
  const sku = str(fd, "sku").toUpperCase();
  const categoryId = str(fd, "categoryId");
  if (!name || !sku || !categoryId) flashRedirect(back, { err: "الاسم ورمز SKU والقسم حقول مطلوبة" });

  let variants: z.infer<typeof variantSchema>[];
  try {
    variants = z.array(variantSchema).min(1).parse(JSON.parse(str(fd, "variants")));
  } catch {
    flashRedirect(back, { err: "بيانات الخيارات غير صحيحة" });
  }
  variants = variants.map((v, i) => ({ ...v, sku: (v.sku || (variants.length === 1 ? sku : `${sku}-${i + 1}`)).toUpperCase() }));
  if (variants.some((v) => dec(v.price) <= 0)) flashRedirect(back, { err: "سعر البيع مطلوب لكل خيار" });
  if (new Set(variants.map((v) => v.sku)).size !== variants.length) flashRedirect(back, { err: "رموز SKU للخيارات يجب أن تكون مختلفة" });

  const slug = slugify(str(fd, "slug") || name) || sku.toLowerCase();
  const [dupSku, dupSlug, dupVariant] = await Promise.all([
    db.product.findFirst({ where: { sku, NOT: id ? { id } : undefined } }),
    db.product.findFirst({ where: { slug, NOT: id ? { id } : undefined } }),
    db.productVariant.findFirst({ where: { sku: { in: variants.map((v) => v.sku) }, NOT: id ? { productId: id } : undefined } }),
  ]);
  if (dupSku) flashRedirect(back, { err: "رمز SKU مستخدم لمنتج آخر" });
  if (dupSlug) flashRedirect(back, { err: "رابط المنتج مستخدم، اختر رابطاً آخر" });
  if (dupVariant) flashRedirect(back, { err: `رمز الخيار ${dupVariant.sku} مستخدم لمنتج آخر` });

  const newImages: string[] = [];
  try {
    for (const f of fd.getAll("images")) {
      const url = await saveUpload(f as File, "products");
      if (url) newImages.push(url);
    }
  } catch (e) {
    flashRedirect(back, { err: (e as Error).message });
  }
  for (const line of str(fd, "imageUrls").split("\n").map((s) => s.trim())) if (/^https?:\/\//.test(line)) newImages.push(line);

  const sourcingType = str(fd, "sourcingType") === "LOCAL_STOCK" ? "LOCAL_STOCK" : "IMPORT_ON_ORDER";
  const supplierId = str(fd, "supplierId") || null;
  const data = {
    name,
    sku,
    slug,
    categoryId,
    description: str(fd, "description"),
    nameEn: str(fd, "nameEn"),
    descriptionEn: str(fd, "descriptionEn"),
    specs: parseSpecs(str(fd, "specs")) as Prisma.InputJsonValue,
    countryOfOrigin: str(fd, "countryOfOrigin") || null,
    sourcingType,
    leadTimeDays: str(fd, "leadTimeDays") ? Math.max(0, Math.round(num(fd, "leadTimeDays"))) : null,
    published: bool(fd, "published"),
    featured: bool(fd, "featured"),
  } as const;

  const before = id ? await db.product.findUnique({ where: { id }, include: { variants: { include: { cost: true } }, images: true } }) : null;
  if (id && !before) flashRedirect("/admin/products", { err: "المنتج غير موجود" });

  const productId = await db.$transaction(async (tx) => {
    const p = id ? await tx.product.update({ where: { id }, data }) : await tx.product.create({ data });

    // الصور: حذف المحدد، تحديث الترتيب، إضافة الجديد
    const removeIds = fd.getAll("removeImage").map(String);
    if (removeIds.length) await tx.productImage.deleteMany({ where: { productId: p.id, id: { in: removeIds } } });
    for (const img of before?.images ?? []) {
      const so = fd.get(`imgOrder_${img.id}`);
      if (so !== null && !removeIds.includes(img.id)) await tx.productImage.update({ where: { id: img.id }, data: { sortOrder: Number(so) || 0 } });
    }
    const maxOrder = (before?.images ?? []).reduce((m, i) => Math.max(m, i.sortOrder), 0);
    for (const [k, url] of newImages.entries()) await tx.productImage.create({ data: { productId: p.id, url, sortOrder: maxOrder + k + 1 } });

    // الخيارات: الخيارات المحذوفة من النموذج تُعطَّل إن كانت مرتبطة بطلبات، وإلا تُحذف
    const keepIds = variants.map((v) => v.id).filter(Boolean) as string[];
    for (const old of before?.variants ?? []) {
      if (keepIds.includes(old.id)) continue;
      const used = await tx.orderItem.count({ where: { variantId: old.id } });
      if (used) await tx.productVariant.update({ where: { id: old.id }, data: { active: false } });
      else await tx.productVariant.delete({ where: { id: old.id } });
    }
    for (const v of variants) {
      const vData = {
        sku: v.sku,
        name: v.name || [v.color, v.size].filter(Boolean).join(" / "),
        nameEn: v.nameEn,
        size: v.size || null,
        color: v.color || null,
        price: new Prisma.Decimal(dec(v.price).toFixed(2)),
        compareAtPrice: dec(v.compareAtPrice) > 0 ? new Prisma.Decimal(dec(v.compareAtPrice).toFixed(2)) : null,
        active: v.active,
      };
      const existing = v.id ? before?.variants.find((x) => x.id === v.id) : undefined;
      const newStock = sourcingType === "LOCAL_STOCK" ? Math.max(0, Math.round(dec(v.stockQty))) : (existing?.stockQty ?? 0);
      const saved = existing
        ? await tx.productVariant.update({ where: { id: existing.id }, data: { ...vData, stockQty: newStock } })
        : await tx.productVariant.create({ data: { ...vData, stockQty: newStock, productId: p.id } });
      const diff = newStock - (existing?.stockQty ?? 0);
      if (diff !== 0) await tx.inventoryMovement.create({ data: { variantId: saved.id, type: existing ? "ADJUST" : "IN", quantity: diff, note: "تعديل من صفحة المنتج", userId: u.id } });

      if (showCosts) {
        const c = v.cost;
        const costData = {
          supplierId,
          purchasePrice: new Prisma.Decimal(dec(c.purchasePrice).toFixed(2)),
          purchaseCurrency: c.purchaseCurrency || "USD",
          shippingCost: new Prisma.Decimal(dec(c.shippingCost).toFixed(2)),
          shippingCurrency: c.shippingCurrency || "USD",
          otherFeesLyd: new Prisma.Decimal(dec(c.otherFeesLyd).toFixed(2)),
          localDeliveryLyd: new Prisma.Decimal(dec(c.localDeliveryLyd).toFixed(2)),
          marginType: c.marginType,
          marginValue: new Prisma.Decimal(dec(c.marginValue).toFixed(2)),
        };
        const hasAny = dec(c.purchasePrice) > 0 || dec(c.shippingCost) > 0 || dec(c.otherFeesLyd) > 0 || dec(c.localDeliveryLyd) > 0 || supplierId;
        if (hasAny) await tx.productCost.upsert({ where: { variantId: saved.id }, create: { variantId: saved.id, ...costData }, update: costData });
      }
    }
    return p.id;
  });

  const after = await db.product.findUnique({ where: { id: productId }, include: { variants: true } });
  await audit(u.id, id ? "update" : "create", "Product", productId, before ?? undefined, after);
  revalidatePath("/", "layout");
  flashRedirect(`/admin/products/${productId}`, { ok: "تم حفظ المنتج" });
}

export async function deleteProduct(fd: FormData) {
  const u = await requireUser("products.manage");
  const id = str(fd, "id");
  const p = await db.product.findUnique({ where: { id }, include: { variants: { select: { id: true } } } });
  if (!p) redirect("/admin/products");
  const used = await db.orderItem.count({ where: { variantId: { in: p.variants.map((v) => v.id) } } });
  if (used) flashRedirect(`/admin/products/${id}`, { err: "المنتج مرتبط بطلبات سابقة ولا يمكن حذفه. ألغِ نشره بدلاً من ذلك." });
  await db.product.delete({ where: { id } });
  await audit(u.id, "delete", "Product", id, p);
  revalidatePath("/", "layout");
  flashRedirect("/admin/products", { ok: "تم حذف المنتج" });
}
