import Link from "next/link";
import { lyd } from "@/lib/format";

export type CardProduct = {
  slug: string;
  name: string;
  image: string | null;
  price: number;
  compareAtPrice: number | null;
  sourcingType: "LOCAL_STOCK" | "IMPORT_ON_ORDER";
  leadTimeDays: number | null;
  inStock: boolean;
};

export function ProductCard({ p }: { p: CardProduct }) {
  const off = p.compareAtPrice && p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0;
  return (
    <Link href={`/product/${encodeURIComponent(p.slug)}`} className="card group flex flex-col overflow-hidden transition hover:shadow-md">
      <div className="relative aspect-square bg-gray-100">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt={p.name} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center text-sm text-gray-400">لا توجد صورة</div>
        )}
        {off > 0 && <span className="badge absolute right-2 top-2 bg-red-600 text-white">-{off}%</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium">{p.name}</h3>
        <div className="mt-auto flex items-baseline gap-2">
          <span className="font-bold text-brand-700">{lyd(p.price)}</span>
          {off > 0 && <span className="text-xs text-gray-400 line-through">{lyd(p.compareAtPrice)}</span>}
        </div>
        <span className="text-xs text-gray-500">
          {p.sourcingType === "LOCAL_STOCK" ? (p.inStock ? "متوفر في ليبيا" : "نفدت الكمية") : `يُطلب من الخارج${p.leadTimeDays ? ` · خلال ${p.leadTimeDays} يوماً تقريباً` : ""}`}
        </span>
      </div>
    </Link>
  );
}
