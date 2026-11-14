import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { categoryWithDescendants } from "@/lib/catalog";
import { Listing, type ListingParams } from "@/components/listing";

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<ListingParams> }) {
  const slug = decodeURIComponent((await params).slug);
  const cat = await db.category.findFirst({
    where: { slug, active: true },
    include: { parent: true, children: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!cat) notFound();
  const ids = await categoryWithDescendants(cat.id);
  return (
    <div className="container-x py-8">
      <nav className="mb-2 text-sm text-gray-500">
        <Link href="/">الرئيسية</Link>
        {cat.parent && <> / <Link href={`/category/${encodeURIComponent(cat.parent.slug)}`}>{cat.parent.name}</Link></>}
      </nav>
      <h1 className="mb-4 text-2xl font-bold">{cat.name}</h1>
      {cat.children.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {cat.children.map((c) => (
            <Link key={c.id} href={`/category/${encodeURIComponent(c.slug)}`} className="btn-outline">{c.name}</Link>
          ))}
        </div>
      )}
      <Listing base={`/category/${encodeURIComponent(cat.slug)}`} params={await searchParams} categoryIds={ids} />
    </div>
  );
}
