import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import type { CardProduct } from "@/components/product-card";

// لا يقرأ هذا الملف جدول التكاليف أبداً: هو مصدر بيانات الواجهة العامة.
export const cardInclude = {
  images: { orderBy: { sortOrder: "asc" }, take: 1 },
  variants: { where: { active: true }, orderBy: { price: "asc" }, select: { price: true, compareAtPrice: true, stockQty: true } },
} satisfies Prisma.ProductInclude;

type WithCard = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

export function toCard(p: WithCard): CardProduct | null {
  const v = p.variants[0];
  if (!v) return null;
  return {
    slug: p.slug,
    name: p.name,
    nameEn: p.nameEn,
    image: p.images[0]?.url ?? null,
    price: Number(v.price),
    compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
    sourcingType: p.sourcingType,
    leadTimeDays: p.leadTimeDays,
    inStock: p.sourcingType === "IMPORT_ON_ORDER" || p.variants.some((x) => x.stockQty > 0),
  };
}

export const cards = (ps: WithCard[]) => ps.map(toCard).filter((c): c is CardProduct => c !== null);

export const publishedWhere: Prisma.ProductWhereInput = { published: true, variants: { some: { active: true } } };

export async function categoryTree() {
  const all = await db.category.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const roots = all.filter((c) => !c.parentId);
  return roots.map((r) => ({ ...r, children: all.filter((c) => c.parentId === r.id) }));
}

/** معرّفات القسم وكل أقسامه الفرعية */
export async function categoryWithDescendants(id: string): Promise<string[]> {
  const all = await db.category.findMany({ select: { id: true, parentId: true } });
  const out = [id];
  for (let i = 0; i < out.length; i++) for (const c of all) if (c.parentId === out[i]) out.push(c.id);
  return out;
}
