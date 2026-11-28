import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { categoryWithDescendants } from "@/lib/catalog";
import { Listing, type ListingParams } from "@/components/listing";
import { getDict } from "@/lib/locale";
import { pick } from "@/lib/i18n";

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<ListingParams> }) {
  const slug = decodeURIComponent((await params).slug);
  const cat = await db.category.findFirst({
    where: { slug, active: true },
    include: { parent: true, children: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!cat) notFound();
  const [ids, { l, t }] = await Promise.all([categoryWithDescendants(cat.id), getDict()]);
  return (
    <div className="container-x py-8">
      <nav className="mb-2 text-sm text-gray-500">
        <Link href="/">{t.home}</Link>
        {cat.parent && <> / <Link href={`/category/${encodeURIComponent(cat.parent.slug)}`}>{pick(l, cat.parent.name, cat.parent.nameEn)}</Link></>}
      </nav>
      <h1 className="mb-4 text-2xl font-bold">{pick(l, cat.name, cat.nameEn)}</h1>
      {cat.children.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {cat.children.map((c) => (
            <Link key={c.id} href={`/category/${encodeURIComponent(c.slug)}`} className="btn-outline">{pick(l, c.name, c.nameEn)}</Link>
          ))}
        </div>
      )}
      <Listing base={`/category/${encodeURIComponent(cat.slug)}`} params={await searchParams} categoryIds={ids} l={l} />
    </div>
  );
}
