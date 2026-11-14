import { Listing, type ListingParams } from "@/components/listing";

export const metadata = { title: "البحث" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<ListingParams> }) {
  const sp = await searchParams;
  return (
    <div className="container-x py-8">
      <h1 className="mb-6 text-2xl font-bold">{sp.q ? `نتائج البحث عن «${sp.q}»` : sp.offers ? "العروض والخصومات" : "كل المنتجات"}</h1>
      <Listing base="/search" params={sp} />
    </div>
  );
}
