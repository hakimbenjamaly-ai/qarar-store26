import Link from "next/link";
import { headers } from "next/headers";
import { CartProvider, CartBadge } from "@/components/cart";
import { getSettings } from "@/lib/settings";
import { categoryTree } from "@/lib/catalog";
import { getDict } from "@/lib/locale";
import { pick } from "@/lib/i18n";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [s, tree, { l, t }, h] = await Promise.all([getSettings(), categoryTree(), getDict(), headers()]);
  const here = h.get("x-qarar-url") ?? "/";
  const other = l === "ar" ? "en" : "ar";
  const address = pick(l, s.address, s.addressEn);
  const tagline = pick(l, s.tagline, s.taglineEn);
  return (
    <CartProvider l={l}>
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
            <input name="q" placeholder={t.searchPlaceholder} className="input rounded-e-none" aria-label={t.search} />
            <button className="btn-primary rounded-s-none">{t.search}</button>
          </form>
          <Link href="/track" className="hidden text-sm text-gray-700 hover:text-brand-700 sm:block">{t.trackOrder}</Link>
          <a href={`/lang?${new URLSearchParams({ to: other, back: here })}`} lang={other} className="rounded-lg border px-2 py-1 text-sm hover:bg-gray-100" hrefLang={other}>{t.switchTo}</a>
          <Link href="/cart" className="relative rounded-lg p-2 hover:bg-gray-100" aria-label={t.cart}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.5L21 8H6" /><circle cx="10" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /></svg>
            <CartBadge />
          </Link>
        </div>
        <nav className="border-t">
          <div className="container-x flex gap-1 overflow-x-auto py-2 text-sm lg:flex-wrap lg:overflow-visible">
            {tree.map((c) => (
              <div key={c.id} className="group relative shrink-0">
                <Link href={`/category/${encodeURIComponent(c.slug)}`} className="block rounded-md px-3 py-1.5 hover:bg-brand-50 hover:text-brand-700">{pick(l, c.name, c.nameEn)}</Link>
                {c.children.length > 0 && (
                  <div className="absolute start-0 top-full z-40 hidden min-w-48 rounded-lg border bg-white p-1 shadow-lg group-hover:block">
                    {c.children.map((ch) => (
                      <Link key={ch.id} href={`/category/${encodeURIComponent(ch.slug)}`} className="block rounded px-3 py-2 hover:bg-gray-50">{pick(l, ch.name, ch.nameEn)}</Link>
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
            {tagline && <p className="text-gray-600">{tagline}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/track" className="hover:text-brand-700">{t.footerTrack}</Link>
            <Link href="/policies" className="hover:text-brand-700">{t.footerPolicies}</Link>
            <Link href="/faq" className="hover:text-brand-700">{t.footerFaq}</Link>
            <Link href="/contact" className="hover:text-brand-700">{t.footerContact}</Link>
          </div>
          <div className="flex flex-col gap-1 text-gray-600">
            {s.phone && <span>{t.phone}: <a dir="ltr" href={`tel:${s.phone}`}>{s.phone}</a></span>}
            {s.whatsapp && <span>{t.whatsapp}: <a dir="ltr" href={`https://wa.me/${s.whatsapp.replace(/\D/g, "").replace(/^0/, "218")}`}>{s.whatsapp}</a></span>}
            {s.email && <span>{t.email}: {s.email}</span>}
            {address && <span>{address}</span>}
          </div>
        </div>
        <div className="border-t py-4 text-center text-xs text-gray-500">© {new Date().getFullYear()} {s.storeName}</div>
      </footer>
    </CartProvider>
  );
}
