import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { dateOnly } from "@/lib/format";
import { Gallery } from "@/components/gallery";
import { ProductBuy } from "@/components/product-buy";

// ملاحظة: هذا الاستعلام لا يضمّن جدول التكاليف ولا المورد — بيانات داخلية لا تصل للعميل.
async function load(slug: string) {
  return db.product.findFirst({
    where: { slug, published: true },
    include: {
      category: { include: { parent: true } },
      images: { orderBy: { sortOrder: "asc" } },
      variants: { where: { active: true }, orderBy: { price: "asc" }, select: { id: true, name: true, size: true, color: true, price: true, compareAtPrice: true, stockQty: true } },
      reviews: { where: { approved: true }, orderBy: { createdAt: "desc" }, include: { customer: { select: { fullName: true } } } },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await load(decodeURIComponent((await params).slug));
  return p ? { title: p.name, description: p.description.slice(0, 160) } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await load(decodeURIComponent((await params).slug));
  if (!p || p.variants.length === 0) notFound();
  const specs = Array.isArray(p.specs) ? (p.specs as { label: string; value: string }[]) : [];
  const avg = p.reviews.length ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length : 0;
  const local = p.sourcingType === "LOCAL_STOCK";

  return (
    <div className="container-x py-8">
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/">الرئيسية</Link>
        {p.category.parent && <> / <Link href={`/category/${encodeURIComponent(p.category.parent.slug)}`}>{p.category.parent.name}</Link></>}
        {" / "}<Link href={`/category/${encodeURIComponent(p.category.slug)}`}>{p.category.name}</Link>
      </nav>
      <div className="grid gap-8 md:grid-cols-2">
        <Gallery images={p.images.map((i) => i.url)} alt={p.name} />
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold">{p.name}</h1>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500">
              <span>رمز المنتج: {p.sku}</span>
              {p.countryOfOrigin && <span>بلد المنشأ: {p.countryOfOrigin}</span>}
              {p.reviews.length > 0 && <span>★ {avg.toFixed(1)} ({p.reviews.length} تقييم)</span>}
            </div>
          </div>
          <div className={`rounded-lg p-3 text-sm ${local ? "bg-emerald-50 text-emerald-800" : "bg-sky-50 text-sky-800"}`}>
            {local
              ? "متوفر في ليبيا ويُجهَّز للتوصيل مباشرة بعد تأكيد الطلب."
              : `يُطلب من المورد بعد تأكيد طلبك${p.leadTimeDays ? `، ومدة التوفير التقديرية حوالي ${p.leadTimeDays} يوماً` : ""}.`}
          </div>
          <ProductBuy
            slug={p.slug}
            name={p.name}
            image={p.images[0]?.url ?? null}
            local={local}
            variants={p.variants.map((v) => ({ ...v, price: Number(v.price), compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null }))}
          />
        </div>
      </div>

      {p.description && (
        <section className="card mt-10 p-6">
          <h2 className="mb-3 text-lg font-bold">الوصف</h2>
          <div className="prose-ar">{p.description}</div>
        </section>
      )}
      {specs.length > 0 && (
        <section className="card mt-6 overflow-hidden">
          <h2 className="p-6 pb-3 text-lg font-bold">المواصفات</h2>
          <table className="table">
            <tbody>
              {specs.map((s, i) => (
                <tr key={i}><th className="w-1/3">{s.label}</th><td>{s.value}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <section className="card mt-6 p-6">
        <h2 className="mb-3 text-lg font-bold">تقييمات العملاء</h2>
        {p.reviews.length === 0 ? (
          <p className="text-sm text-gray-500">لا توجد تقييمات بعد. يمكن للعملاء تقييم المنتج بعد استلام طلبهم من صفحة متابعة الطلب.</p>
        ) : (
          <ul className="divide-y">
            {p.reviews.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-amber-500">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  <span className="font-medium">{r.customer.fullName.split(" ")[0]}</span>
                  <span className="text-gray-400">{dateOnly(r.createdAt)}</span>
                </div>
                {r.body && <p className="mt-1 text-sm text-gray-700">{r.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
