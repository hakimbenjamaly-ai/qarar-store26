import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { cardInclude, cards, publishedWhere } from "@/lib/catalog";
import { ProductCard } from "./product-card";

export type ListingParams = { q?: string; sort?: string; min?: string; max?: string; offers?: string; avail?: string; page?: string };

const PAGE = 24;

export async function Listing({ base, params, categoryIds }: { base: string; params: ListingParams; categoryIds?: string[] }) {
  const q = (params.q ?? "").trim().slice(0, 100);
  const min = Number(params.min) || undefined;
  const max = Number(params.max) || undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const and: Prisma.ProductWhereInput[] = [publishedWhere];
  if (categoryIds) and.push({ categoryId: { in: categoryIds } });
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { sku: { equals: q, mode: "insensitive" } },
        { category: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (min || max) and.push({ variants: { some: { active: true, price: { gte: min, lte: max } } } });
  if (params.offers) and.push({ variants: { some: { active: true, compareAtPrice: { not: null } } } });
  if (params.avail === "local") and.push({ sourcingType: "LOCAL_STOCK", variants: { some: { active: true, stockQty: { gt: 0 } } } });
  if (params.avail === "import") and.push({ sourcingType: "IMPORT_ON_ORDER" });

  const where: Prisma.ProductWhereInput = { AND: and };
  const orderBy: Prisma.ProductOrderByWithRelationInput = params.sort === "name" ? { name: "asc" } : { createdAt: "desc" };

  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({ where, include: cardInclude, orderBy, skip: (page - 1) * PAGE, take: PAGE }),
  ]);
  let items = cards(rows);
  if (params.offers) items = items.filter((c) => c.compareAtPrice && c.compareAtPrice > c.price);
  if (params.sort === "price_asc") items.sort((a, b) => a.price - b.price);
  if (params.sort === "price_desc") items.sort((a, b) => b.price - a.price);
  const pages = Math.ceil(total / PAGE);

  const link = (p: number) => {
    const sp = new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `${base}?${sp}`;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <form action={base} className="card h-fit space-y-4 p-4 text-sm">
        <div>
          <label className="label" htmlFor="q">كلمة البحث</label>
          <input id="q" name="q" defaultValue={q} className="input" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="min">من (د.ل)</label>
            <input id="min" name="min" type="number" min={0} defaultValue={params.min} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="max">إلى (د.ل)</label>
            <input id="max" name="max" type="number" min={0} defaultValue={params.max} className="input" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="avail">التوفر</label>
          <select id="avail" name="avail" defaultValue={params.avail ?? ""} className="input">
            <option value="">الكل</option>
            <option value="local">متوفر في ليبيا</option>
            <option value="import">يُطلب من الخارج</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="sort">الترتيب</label>
          <select id="sort" name="sort" defaultValue={params.sort ?? "new"} className="input">
            <option value="new">الأحدث</option>
            <option value="price_asc">السعر: الأقل أولاً</option>
            <option value="price_desc">السعر: الأعلى أولاً</option>
            <option value="name">الاسم</option>
          </select>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="offers" value="1" defaultChecked={!!params.offers} /> العروض فقط
        </label>
        <button className="btn-primary w-full">تطبيق</button>
      </form>
      <div>
        <p className="mb-3 text-sm text-gray-500">{total} منتج</p>
        {items.length === 0 ? (
          <div className="card p-8 text-center text-gray-600">لا توجد منتجات مطابقة.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((p) => <ProductCard key={p.slug} p={p} />)}
          </div>
        )}
        {pages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <Link key={p} href={link(p)} className={p === page ? "btn-primary" : "btn-outline"}>{p}</Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
