import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { brandVars, getSettings } from "@/lib/settings";
import { getLocale } from "@/lib/locale";
import { dirOf, pick } from "@/lib/i18n";

export const dynamic = "force-dynamic";

async function pageLocale() {
  const path = (await headers()).get("x-qarar-path") ?? "";
  return path.startsWith("/admin") ? "ar" : await getLocale();
}

export async function generateMetadata(): Promise<Metadata> {
  const [s, l] = await Promise.all([getSettings(), pageLocale()]);
  return {
    title: { default: s.storeName, template: `%s | ${s.storeName}` },
    description: pick(l, s.tagline, s.taglineEn) || s.storeName,
    icons: s.logoUrl ? [{ url: s.logoUrl }] : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [s, l] = await Promise.all([getSettings(), pageLocale()]);
  return (
    <html lang={l} dir={dirOf(l)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: brandVars(s.brandColor) }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
