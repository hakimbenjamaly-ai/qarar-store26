import Link from "next/link";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lyd } from "@/lib/format";
import { Empty, Flash, PageHeader } from "@/components/admin/ui";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; state?: string; ok?: string; err?: string; page?: string }> }) {
  await requireUser("products.manage");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.ProductWhereInput = {};
  if (sp.q) where.OR = [{ name: { contains: sp.q, mode: "insensitive" } }, { sku: { contains: sp.q, mode: "insensitive" } }, { variants: { some: { sku: { contains: sp.q, mode: "insensitive" } } } }];
  if (sp.category) where.categoryId = sp.category;
  if (sp.state === "published") where.published = true;
  if (sp.state === "draft") where.published = false;
  const [cats, total, rows] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * 50,
      take: 50,
      include: { category: true, images: { take: 1, orderBy: { sortOrder: "asc" } }, variants: { select: { price: true, stockQty: true, active: true } } },
    }),
  ]);
  return (
    <div>
      <PageHeader title="المنتجات" actions={<Link href="/admin/products/new" className="btn-primary">+ منتج جديد</Link>} />
      <Flash ok={sp.ok} err={sp.err} />
      <form className="card mb-4 flex flex-wrap gap-2 p-3 text-sm">
        <input name="q" defaultValue={sp.q} placeholder="بحث بالاسم أو SKU" className="input w-64" />
        <select name="category" defaultValue={sp.category ?? ""} className="input w-56">
          <option value="">كل الأقسام</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="state" defaultValue={sp.state ?? ""} className="input w-40">
          <option value="">الكل</option>
          <option value="published">منشور</option>
          <option value="draft">غير منشور</option>
        </select>
        <button className="btn-outline">بحث</button>
      </form>
      {rows.length === 0 ? (
        <Empty>لا توجد منتجات. <Link href="/admin/products/new" className="text-brand-700 underline">أضف أول منتج</Link></Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th></th><th>المنتج</th><th>SKU</th><th>القسم</th><th>النوع</th><th>السعر</th><th>المخزون</th><th>الحالة</th></tr></thead>
            <tbody>
              {rows.map((p) => {
                const prices = p.variants.filter((v) => v.active).map((v) => Number(v.price));
                const stock = p.variants.reduce((s, v) => s + v.stockQty, 0);
                return (
                  <tr key={p.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <td className="w-12">{p.images[0] && <img src={p.images[0].url} alt="" className="h-10 w-10 rounded object-cover" />}</td>
                    <td><Link href={`/admin/products/${p.id}`} className="font-medium text-brand-700 hover:underline">{p.name}</Link></td>
                    <td dir="ltr" className="text-right">{p.sku}</td>
                    <td>{p.category.name}</td>
                    <td>{p.sourcingType === "LOCAL_STOCK" ? "محلي" : "استيراد"}</td>
                    <td>{prices.length ? lyd(Math.min(...prices)) : "—"}</td>
                    <td>{p.sourcingType === "LOCAL_STOCK" ? stock : "—"}</td>
                    <td>{p.published ? <span className="badge bg-emerald-100 text-emerald-800">منشور</span> : <span className="badge bg-gray-200">مسودة</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex justify-between p-3 text-sm text-gray-500">
            <span>{total} منتج</span>
            <span className="flex gap-2">
              {page > 1 && <Link href={`?${new URLSearchParams({ ...sp, page: String(page - 1) } as Record<string, string>)}`}>السابق</Link>}
              {page * 50 < total && <Link href={`?${new URLSearchParams({ ...sp, page: String(page + 1) } as Record<string, string>)}`}>التالي</Link>}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
