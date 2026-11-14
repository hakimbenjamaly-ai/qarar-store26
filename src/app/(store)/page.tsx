import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { cardInclude, cards, categoryTree, publishedWhere } from "@/lib/catalog";
import { ProductCard, type CardProduct } from "@/components/product-card";

export const dynamic = "force-dynamic";

function Section({ title, href, items }: { title: string; href?: string; items: CardProduct[] }) {
  if (items.length === 0) return null;
  return (
    <section className="container-x mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        {href && <Link href={href} className="text-sm text-brand-700 hover:underline">عرض الكل</Link>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((p) => <ProductCard key={p.slug} p={p} />)}
      </div>
    </section>
  );
}

export default async function Home() {
  const [s, tree] = await Promise.all([getSettings(), categoryTree()]);

  // الأكثر طلباً: محسوبة من الطلبات الفعلية فقط (غير الملغاة)
  const top = await db.orderItem.groupBy({
    by: ["variantId"],
    where: { status: { not: "CANCELLED" } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 40,
  });
  const topVariantIds = top.map((t) => t.variantId);
  const topVariants = topVariantIds.length
    ? await db.productVariant.findMany({ where: { id: { in: topVariantIds } }, select: { id: true, productId: true } })
    : [];
  const topProductIds = [...new Set(topVariantIds.map((id) => topVariants.find((v) => v.id === id)?.productId).filter(Boolean))] as string[];

  const [bestRaw, newest, featured, offersRaw] = await Promise.all([
    topProductIds.length ? db.product.findMany({ where: { ...publishedWhere, id: { in: topProductIds } }, include: cardInclude }) : [],
    db.product.findMany({ where: publishedWhere, include: cardInclude, orderBy: { createdAt: "desc" }, take: 10 }),
    db.product.findMany({ where: { ...publishedWhere, featured: true }, include: cardInclude, orderBy: { updatedAt: "desc" }, take: 10 }),
    db.product.findMany({ where: { ...publishedWhere, variants: { some: { active: true, compareAtPrice: { not: null } } } }, include: cardInclude, take: 30 }),
  ]);
  const best = topProductIds.map((id) => bestRaw.find((p) => p.id === id)).filter((p): p is (typeof bestRaw)[number] => !!p).slice(0, 10);
  const offers = cards(offersRaw).filter((c) => c.compareAtPrice && c.compareAtPrice > c.price).slice(0, 10);
  const empty = newest.length === 0;

  return (
    <>
      <section className="bg-gradient-to-l from-brand-700 to-brand-900 text-white">
        <div className="container-x py-12 sm:py-16">
          <h1 className="text-3xl font-bold sm:text-4xl">{s.heroTitle || s.storeName}</h1>
          {s.heroText && <p className="mt-3 max-w-2xl text-lg text-white/85">{s.heroText}</p>}
          <div className="mt-6 flex gap-3">
            <a href="#categories" className="btn bg-white text-brand-700 hover:bg-brand-50">تصفح الأقسام</a>
            <Link href="/track" className="btn border border-white/60 text-white hover:bg-white/10">تتبع طلبك</Link>
          </div>
        </div>
      </section>

      <section id="categories" className="container-x mt-10">
        <h2 className="mb-4 text-xl font-bold">الأقسام</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {tree.map((c) => (
            <Link key={c.id} href={`/category/${encodeURIComponent(c.slug)}`} className="card flex flex-col items-center gap-2 p-4 text-center text-sm font-medium hover:border-brand-600 hover:text-brand-700">
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
              ) : (
                <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-lg font-bold text-brand-700">{c.name.replace(/^ال/, "").slice(0, 1)}</span>
              )}
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      {empty && (
        <section className="container-x mt-10">
          <div className="card p-8 text-center text-gray-600">لم تُضف منتجات بعد. ستظهر المنتجات هنا فور نشرها من لوحة الإدارة.</div>
        </section>
      )}
      <Section title="مختارات" items={cards(featured)} />
      <Section title="الأكثر طلباً" items={cards(best)} />
      <Section title="العروض والخصومات" href="/search?offers=1" items={offers} />
      <Section title="وصل حديثاً" href="/search?sort=new" items={cards(newest)} />
    </>
  );
}
