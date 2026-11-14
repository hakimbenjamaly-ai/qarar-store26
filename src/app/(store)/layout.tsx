import Link from "next/link";
import { CartProvider, CartBadge } from "@/components/cart";
import { getSettings } from "@/lib/settings";
import { categoryTree } from "@/lib/catalog";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [s, tree] = await Promise.all([getSettings(), categoryTree()]);
  return (
    <CartProvider>
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="container-x flex items-center gap-3 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            {s.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logoUrl} alt={s.storeName} className="h-10 w-auto" />
            ) : (
              <span className="text-2xl font-bold text-brand-700">{s.storeName}</span>
            )}
          </Link>
          <form action="/search" className="mx-2 flex flex-1">
            <input name="q" placeholder="ابحث عن منتج..." className="input rounded-l-none" aria-label="بحث" />
            <button className="btn-primary rounded-r-none">بحث</button>
          </form>
          <Link href="/track" className="hidden text-sm text-gray-700 hover:text-brand-700 sm:block">تتبع طلبك</Link>
          <Link href="/cart" className="relative rounded-lg p-2 hover:bg-gray-100" aria-label="السلة">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.5L21 8H6" /><circle cx="10" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /></svg>
            <CartBadge />
          </Link>
        </div>
        <nav className="border-t">
          <div className="container-x flex gap-1 overflow-x-auto py-2 text-sm lg:flex-wrap lg:overflow-visible">
            {tree.map((c) => (
              <div key={c.id} className="group relative shrink-0">
                <Link href={`/category/${encodeURIComponent(c.slug)}`} className="block rounded-md px-3 py-1.5 hover:bg-brand-50 hover:text-brand-700">{c.name}</Link>
                {c.children.length > 0 && (
                  <div className="absolute right-0 top-full z-40 hidden min-w-48 rounded-lg border bg-white p-1 shadow-lg group-hover:block">
                    {c.children.map((ch) => (
                      <Link key={ch.id} href={`/category/${encodeURIComponent(ch.slug)}`} className="block rounded px-3 py-2 hover:bg-gray-50">{ch.name}</Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>
      </header>
      <main className="min-h-[60vh]">{children}</main>
      <footer className="mt-16 border-t bg-white">
        <div className="container-x grid gap-8 py-10 text-sm sm:grid-cols-3">
          <div>
            <div className="mb-2 text-lg font-bold text-brand-700">{s.storeName}</div>
            {s.tagline && <p className="text-gray-600">{s.tagline}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/track" className="hover:text-brand-700">متابعة الطلب</Link>
            <Link href="/policies" className="hover:text-brand-700">سياسة الشراء والاستبدال والاسترجاع</Link>
            <Link href="/faq" className="hover:text-brand-700">الأسئلة الشائعة</Link>
            <Link href="/contact" className="hover:text-brand-700">اتصل بنا</Link>
          </div>
          <div className="flex flex-col gap-1 text-gray-600">
            {s.phone && <span>الهاتف: <a dir="ltr" href={`tel:${s.phone}`}>{s.phone}</a></span>}
            {s.whatsapp && <span>واتساب: <a dir="ltr" href={`https://wa.me/${s.whatsapp.replace(/\D/g, "").replace(/^0/, "218")}`}>{s.whatsapp}</a></span>}
            {s.email && <span>البريد: {s.email}</span>}
            {s.address && <span>{s.address}</span>}
          </div>
        </div>
        <div className="border-t py-4 text-center text-xs text-gray-500">© {new Date().getFullYear()} {s.storeName}</div>
      </footer>
    </CartProvider>
  );
}
