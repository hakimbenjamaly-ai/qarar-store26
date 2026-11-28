import Link from "next/link";
import { dict, money, pick, type Locale } from "@/lib/i18n";

export type CardProduct = {
  slug: string;
  name: string;
  nameEn: string;
  image: string | null;
  price: number;
  compareAtPrice: number | null;
  sourcingType: "LOCAL_STOCK" | "IMPORT_ON_ORDER";
  leadTimeDays: number | null;
  inStock: boolean;
};

export function ProductCard({ p, l }: { p: CardProduct; l: Locale }) {
  const t = dict(l);
  const name = pick(l, p.name, p.nameEn);
  const off = p.compareAtPrice && p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0;
  return (
    <Link href={`/product/${encodeURIComponent(p.slug)}`} className="card group flex flex-col overflow-hidden transition hover:shadow-md">
      <div className="relative aspect-square bg-gray-100">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt={name} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center text-sm text-gray-400">{t.noImage}</div>
        )}
        {off > 0 && <span className="badge absolute start-2 top-2 bg-red-600 text-white" dir="ltr">-{off}%</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium">{name}</h3>
        <div className="mt-auto flex items-baseline gap-2">
          <span className="font-bold text-brand-700">{money(p.price, l)}</span>
          {off > 0 && <span className="text-xs text-gray-400 line-through">{money(p.compareAtPrice, l)}</span>}
        </div>
        <span className="text-xs text-gray-500">
          {p.sourcingType === "LOCAL_STOCK" ? (p.inStock ? t.inLibya : t.soldOut) : `${t.importOnOrder}${p.leadTimeDays ? ` · ${t.withinDays(p.leadTimeDays)}` : ""}`}
        </span>
      </div>
    </Link>
  );
}
