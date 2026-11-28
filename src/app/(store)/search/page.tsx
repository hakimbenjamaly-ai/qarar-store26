import type { Metadata } from "next";
import { Listing, type ListingParams } from "@/components/listing";
import { getDict } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.search };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<ListingParams> }) {
  const [sp, { l, t }] = await Promise.all([searchParams, getDict()]);
  return (
    <div className="container-x py-8">
      <h1 className="mb-6 text-2xl font-bold">{sp.q ? t.searchResults(sp.q) : sp.offers ? t.offers : t.allProducts}</h1>
      <Listing base="/search" params={sp} l={l} />
    </div>
  );
}
